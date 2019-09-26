declare const io: Function;

let timer: any = undefined;

function handleSocketReload(data: any): void {
  if (typeof timer !== 'undefined') {
    clearTimeout(timer);
  }

  timer = setTimeout(function(): void {
    /* reload */
    window.location.reload();
    timer = undefined;
  }, 250);
}

/* client scripts */
function client(https: boolean, port: number): void {
  const socket: any = io(`${ https ? 'https' : 'http' }://127.0.0.1:${ port }/`);

  socket.on('RELOAD', handleSocketReload);
}