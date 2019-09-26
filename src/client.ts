declare const io: Function;

interface ClientType {
  type: '.html';
}

let timer: any = undefined;

function handleSocketReload(data: ClientType): void {
  if (typeof timer !== 'undefined') {
    clearTimeout(timer);
  }

  timer = setTimeout(function(): void {
    if (data.type === '.html') {
      window.location.reload();
    }

    timer = undefined;
  }, 500);
}

/* client scripts */
function client(https: boolean, port: number): void {
  const socket: any = io(`${ https ? 'https' : 'http' }://127.0.0.1:${ port }/`);

  socket.on('RELOAD', handleSocketReload);
}