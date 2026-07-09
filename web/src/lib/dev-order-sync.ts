import { useHub } from "./store";
import { DEFAULT_FAVORITES } from "./tools";
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

export function startDefaultOrderSync(): void {
  // Browser-test fixtures must never become the published defaults.
  if (!import.meta.env.DEV || !import.meta.hot || navigator.webdriver) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    const { pinned, toolOrders } = useHub.getState();
    const customized = Object.values(toolOrders).some((ids) => ids.length > 0)
      || JSON.stringify(pinned) !== JSON.stringify(DEFAULT_FAVORITES.map((tool) => tool.id));
    if (customized) timer = setTimeout(() => { void saveDefaultToolOrder().catch(() => {}); }, 400);
  };
  schedule();
  const unsubscribe = useHub.subscribe((state, previous) => {
    if (state.pinned !== previous.pinned || state.toolOrders !== previous.toolOrders) schedule();
  });
  import.meta.hot.dispose(() => { clearTimeout(timer); unsubscribe(); });
}
