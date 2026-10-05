import { useHub } from "./store";
import { snapshotToolOrders } from "./tool-order";

export function saveDefaultToolOrder(): Promise<void> {
  const hot = import.meta.hot;
  if (!hot) return Promise.reject(new Error("Local development only"));
  const requestId = crypto.randomUUID();
  const { pinned, toolOrders } = useHub.getState();
  return new Promise((resolve, reject) => {
    const finish = (ok: boolean) => {
      clearTimeout(timeout);
      hot.off("arxiv-hub:default-order-saved", onSaved);
      if (ok) resolve();
      else reject(new Error("Default order was not saved"));
    };
    const onSaved = (data: { requestId: string; ok: boolean }) => { if (data.requestId === requestId) finish(data.ok); };
    const timeout = setTimeout(() => finish(false), 8000);
    hot.on("arxiv-hub:default-order-saved", onSaved);
    hot.send("arxiv-hub:save-default-order", { requestId, orders: snapshotToolOrders(pinned, toolOrders) });
  });
}
