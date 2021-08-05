interface ClientArgs {
  reloadTime: number;
}

interface HandleSocketReload {
  (event: MessageEvent): void;
}

let timer: number | undefined = undefined;

function createSocketReloadFunc(reloadTime: number): HandleSocketReload {
  return function handleSocketReload(event: MessageEvent): void {
    if (typeof timer !== 'undefined') {
      clearTimeout(timer);
    }

    timer = window.setTimeout(function(): void {
      /* reload */
      window.location.reload();
      timer = undefined;
    }, reloadTime);
  };
}

/* client scripts */
function client({ reloadTime }: ClientArgs): void {
  const socket: WebSocket = new WebSocket(`ws://${ location.host }/@@/gulp-memory-fs/ws`);

  socket.addEventListener('message', createSocketReloadFunc(reloadTime), false);
}