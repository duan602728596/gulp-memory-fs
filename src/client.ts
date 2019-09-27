declare const io: Function;

interface ClientArgs {
  https: boolean;
  port: number;
  reloadTime: number;
}

let timer: any = undefined;

function createSocketReloadFunc(reloadTime: number): Function {
  return function handleSocketReload(data: any): void {
    if (typeof timer !== 'undefined') {
      clearTimeout(timer);
    }

    timer = setTimeout(function(): void {
      /* reload */
      window.location.reload();
      timer = undefined;
    }, reloadTime);
  };
}

/* client scripts */
function client({ https, port, reloadTime }: ClientArgs): void {
  const socket: any = io(`${ https ? 'https' : 'http' }://127.0.0.1:${ port }/`);

  socket.on('RELOAD', createSocketReloadFunc(reloadTime));
}