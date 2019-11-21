interface ClientArgs {
  reloadTime: number;
}

let timer: number | undefined = undefined;

function createSocketReloadFunc(reloadTime: number): Function {
  return function handleSocketReload(data: any): void {
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
  const socket: SocketIOClient.Socket = io('/');

  socket.on('RELOAD', createSocketReloadFunc(reloadTime));
}