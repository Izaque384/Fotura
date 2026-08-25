/* Service Worker — Push Notifications */

self.addEventListener("push", (event) => {
  let titulo = "Fotura";
  let corpo = "Você tem uma nova notificação.";
  let url = "/dashboard";

  if (event.data) {
    try {
      const dados = event.data.json();
      titulo = dados.titulo || titulo;
      corpo = dados.corpo || corpo;
      url = dados.url || url;
    } catch {
      corpo = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});