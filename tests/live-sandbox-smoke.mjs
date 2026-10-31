// Live Sandbox smoke test against a running server. Prints no secrets.
const base = process.env.BASE ?? "http://localhost:3100";
const post = async (path, body) => {
  const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { http: r.status, ...(await r.json()) };
};
const show = (label, r) => console.log(label.padEnd(34), r.http, r.status, "|", (r.message ?? "").slice(0, 90));

show("unknown product", await post("/api/paypal/orders", { productId: "nope", approved: true }));
show("no approval flag", await post("/api/paypal/orders", { productId: "hp-1", approved: false }));
show("over client limit (hp-1 $79.99 > $50)", await post("/api/paypal/orders", { productId: "hp-1", approved: true, spendingLimit: 50 }));
show("browser-sent amount ignored? (extra)", { http: 0, status: "-", message: "n/a: route has no amount input" });

const order = await post("/api/paypal/orders", { productId: "hp-1", approved: true, spendingLimit: 150, amount: "0.01" });
show("create sandbox order", order);
if (order.approveUrl) {
  console.log("approve host:", new URL(order.approveUrl).hostname, "| orderId length:", order.orderId.length);
  show("capture before buyer approval", await post("/api/paypal/capture", { orderId: order.orderId }));
  const tx = await (await fetch(base + "/api/transactions")).json();
  const rec = tx.transactions.find((t) => t.id === order.orderId);
  console.log("persisted amount:", rec?.amount, rec?.currency, "status:", rec?.status);
  show("cancel", await post("/api/paypal/cancel", { orderId: order.orderId }));
  show("capture after cancel (no capture)", await post("/api/paypal/capture", { orderId: order.orderId }));
}
show("capture unknown order id", await post("/api/paypal/capture", { orderId: "ABCDEFGH12345" }));
show("capture invalid id", await post("/api/paypal/capture", { orderId: "../x" }));
