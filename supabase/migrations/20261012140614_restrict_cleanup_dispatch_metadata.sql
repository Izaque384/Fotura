-- pg_net request metadata includes the private dispatch credential.
revoke all on table net.http_request_queue, net._http_response from public, anon, authenticated, service_role;
