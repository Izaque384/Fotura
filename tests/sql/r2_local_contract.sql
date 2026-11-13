-- Executed ONLY against disposable CI PostgreSQL, after R2 migrations.
-- Every assertion raises and fails the CI job if it does not hold.
do $check$
declare
  uid uuid := '11111111-1111-4111-8111-111111111111';
  project_id uuid := '22222222-2222-4222-8222-222222222222';
  gallery_id uuid := '33333333-3333-4333-8333-333333333333';
  photo_name text := '44444444-4444-4444-8444-444444444444-original.jpg';
  photo_key text;
  thumb_key text;
  video_key text;
  feedback_key text;
  logo_key text;
  published_logo text;
  client_id uuid := '77777777-7777-4777-8777-777777777777';
  avatar_key text;
  stored_avatar text;
  feedback_record uuid;
  cleanup_ticket jsonb;
  v_count integer;
  v_bytes bigint;
begin
  insert into auth.users(id) values (uid);
  logo_key := uid::text || '/' || '99999999-9999-4999-8999-999999999999.webp';
  insert into public.galeria_projetos(id,user_id) values (project_id,uid);
  insert into public.galerias(id,user_id,projeto_id,etapa) values
    (gallery_id,uid,project_id,'prova');
  photo_key := uid::text || '/' || gallery_id::text || '/' || photo_name;
  thumb_key := uid::text || '/' || gallery_id::text || '/thumbs/' || photo_name;
  video_key := uid::text || '/' || project_id::text || '/' ||
    '55555555-5555-4555-8555-555555555555.mp4';
  feedback_key := uid::text || '/' ||
    '66666666-6666-4666-8666-666666666666-feedback.png';

  avatar_key := uid::text || '/' || client_id::text || '/' ||
    '88888888-8888-4888-8888-888888888888.webp';
  insert into public.clientes(id,user_id,nome) values (client_id,uid,'Cliente sintético');

  -- The public URL is stable, but a logo may only become public after
  -- server-side verification and atomic reservation + media registration.
  insert into public.fotura_r2_upload_reservations
    (bucket,object_key,owner_id,expires_at)
  values ('marca',logo_key,uid,now()+interval '24 hours');
  published_logo := public.registrar_logo_r2_backend(
    uid,logo_key,320,'image/webp',null
  );
  if published_logo is distinct from '/api/marca/' || logo_key then
    raise exception 'Studio logo URL did not use expected stable prefix';
  end if;
  select logo_url into stored_avatar from public.perfis where id=uid;
  if stored_avatar is distinct from published_logo then
    raise exception 'Profile logo and registered public URL diverged';
  end if;
  select count(*) into v_count from public.fotura_media_objects
    where bucket='marca' and object_key=logo_key;
  if v_count<>1 then raise exception 'Logo registry entry missing'; end if;
  select count(*) into v_count from public.fotura_r2_upload_reservations
    where bucket='marca' and object_key=logo_key;
  if v_count<>0 then raise exception 'Logo reservation not cleared'; end if;

  -- No upload can be registered without an owner-bound reservation.
  if public.registrar_foto_r2_upload_backend(
    uid,gallery_id,'principal',photo_name,1000,200,'image/jpeg'
  ) then raise exception 'Photo registration without reservation passed'; end if;

  insert into public.fotura_r2_upload_reservations
    (bucket,object_key,thumbnail_key,owner_id,expires_at)
  values ('fotos',photo_key,thumb_key,uid,now()+interval '24 hours');

  if not public.registrar_foto_r2_upload_backend(
    uid,gallery_id,'principal',photo_name,1000,200,'image/jpeg'
  ) then raise exception 'Reserved R2 photo confirmation failed'; end if;

  select count(*) into v_count from public.fotura_media_objects
    where bucket='fotos' and owner_id=uid;
  if v_count<>2 then raise exception 'Photo original and thumbnail not both recorded'; end if;
  select count(*) into v_count from public.fotura_r2_upload_reservations
    where bucket='fotos' and owner_id=uid;
  if v_count<>0 then raise exception 'Photo reservation remained after commit'; end if;

  insert into public.fotura_r2_upload_reservations
    (bucket,object_key,owner_id,expires_at)
  values ('abertura-videos',video_key,uid,now()+interval '24 hours');
  if not public.registrar_video_r2_upload_backend(
    uid,project_id,video_key,2048
  ) then raise exception 'Reserved R2 video confirmation failed'; end if;

  insert into public.fotura_r2_upload_reservations
    (bucket,object_key,owner_id,expires_at)
  values ('client-avatars',avatar_key,uid,now()+interval '24 hours');
  perform public.registrar_avatar_r2_backend(uid,client_id,avatar_key,401,null);
  select avatar_path into stored_avatar from public.clientes where id=client_id;
  if stored_avatar is distinct from avatar_key then
    raise exception 'R2 client avatar reference was not updated'; end if;
  select count(*) into v_count from public.fotura_media_objects
    where bucket='client-avatars' and object_key=avatar_key;
  if v_count<>1 then raise exception 'R2 client avatar registry missing'; end if;
  select count(*) into v_count from public.fotura_r2_upload_reservations
    where bucket='client-avatars' and object_key=avatar_key;
  if v_count<>0 then raise exception 'R2 client avatar pending record was not cleared'; end if;

  insert into public.fotura_r2_upload_reservations
    (bucket,object_key,owner_id,expires_at)
  values ('feedback-anexos',feedback_key,uid,now()+interval '24 hours');
  select feedback_id into feedback_record
  from public.registrar_feedback_r2_backend(
    uid,'problema','galerias','Falha no ensaio',
    'Uma imagem de teste deixou de carregar.',null,
    '/dashboard','Browser',feedback_key,'feedback.png','image/png',512,null
  );
  if feedback_record is null then raise exception 'Feedback was not registered'; end if;
  select count(*) into v_count from public.feedbacks
    where id=feedback_record and screenshot_path=feedback_key;
  if v_count<>1 then raise exception 'Feedback/attachment reference mismatch'; end if;
  select count(*) into v_count from public.fotura_media_objects
    where bucket='feedback-anexos' and object_key=feedback_key;
  if v_count<>1 then raise exception 'Feedback registry entry missing'; end if;
  select count(*) into v_count from public.fotura_r2_upload_reservations
    where bucket='feedback-anexos' and object_key=feedback_key;
  if v_count<>0 then raise exception 'Feedback pending reservation was not cleared'; end if;

  -- The quota-summary RPC cannot count an already copied legacy photo twice.
  select bytes_extra into v_bytes
    from public.r2_extra_storage_gallery_summary_backend(uid)
    where galeria_id=gallery_id;
  if v_bytes<>1200 then raise exception 'R2 gallery quota summary invalid'; end if;

  -- Test only expired unregistered media; the remote DELETE+HEAD step is
  -- deliberately not simulated here, so this checks DB leases only.
  insert into public.fotura_r2_upload_reservations
    (bucket,object_key,owner_id,created_at,expires_at)
  values ('feedback-anexos',uid::text || '/orphan.png',uid,
    now()-interval '3 days',now()-interval '2 days');
  cleanup_ticket := public.r2_pending_cleanup_claim();
  if cleanup_ticket is null or cleanup_ticket->>'bucket'<>'feedback-anexos' then
    raise exception 'Orphan cleanup failed to claim exact expired object';
  end if;
  if not public.r2_pending_cleanup_finish(
    (cleanup_ticket->>'id')::uuid,(cleanup_ticket->>'lease_token')::uuid,true
  ) then raise exception 'Orphan cleanup acknowledgement failed'; end if;
  select count(*) into v_count from public.fotura_r2_upload_reservations
    where bucket='feedback-anexos';
  if v_count<>0 then raise exception 'Orphan cleanup left a reservation'; end if;

  -- Photo cancellation fences registration and defers deletion until all
  -- previously signed PUT permissions have expired. No remote bytes here.
  insert into public.fotura_r2_upload_reservations
    (bucket,object_key,thumbnail_key,owner_id,expires_at,state,lease_until)
  values ('fotos',
    uid::text || '/' || gallery_id::text || '/' ||
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-cancel.jpg',
    uid::text || '/' || gallery_id::text || '/thumbs/' ||
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-cancel.jpg',
    uid,now()+interval '24 hours','cleaning',now()+interval '10 minutes');

  if public.registrar_foto_r2_upload_backend(
    uid,gallery_id,'principal',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-cancel.jpg',
    1000,200,'image/jpeg'
  ) then raise exception 'Cancelled photo was registered'; end if;
  if public.r2_pending_cleanup_claim() is not null then
    raise exception 'Cancelled upload was claimed before the grace period';
  end if;

  update public.fotura_r2_upload_reservations set lease_until=now()-interval '1 minute'
  where bucket='fotos' and owner_id=uid and state='cleaning';
  cleanup_ticket := public.r2_pending_cleanup_claim();
  if cleanup_ticket is null or cleanup_ticket->>'bucket'<>'fotos'
      or cleanup_ticket->>'thumbnail_key' is null then
    raise exception 'Cancelled photo cleanup did not claim both keys';
  end if;
  if not public.r2_pending_cleanup_finish(
    (cleanup_ticket->>'id')::uuid,(cleanup_ticket->>'lease_token')::uuid,true
  ) then raise exception 'Cancelled photo cleanup failed to acknowledge'; end if;
  select count(*) into v_count from public.fotura_r2_upload_reservations
    where bucket='fotos' and owner_id=uid;
  if v_count<>0 then raise exception 'Cancelled photo reservation remained'; end if;
end;
$check$;

-- Registrations are protected from anonymous client calls.
do $check$
declare n integer;
begin
  select count(*) into n
  from information_schema.role_routine_grants
  where routine_schema='public' and routine_name='registrar_feedback_r2_backend'
    and grantee in ('anon','authenticated') and privilege_type='EXECUTE';
  if n>0 then raise exception 'Feedback registration exposed to client role'; end if;
end;
$check$;
