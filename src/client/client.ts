interface ClientArgs {
  reloadTime: number;
}

interface HandleSocketReload {
  (event: MessageEvent): void;
}

/* 定义消息类型 */
interface MessageData {
  type: 'reload';
}

let timer: number | undefined = undefined;

function createSocketReloadFunc(reloadTime: number): HandleSocketReload {
  return function handleSocketReload(event: MessageEvent): void {
    const data: MessageData = JSON.parse(event.data);

    if (data.type === 'reload') {
      /* reload */
      (typeof timer !== 'undefined') && clearTimeout(timer);

      timer = window.setTimeout(function(): void {
        window.location.reload();
        timer = undefined;
      }, reloadTime);
    }
  };
}

/* client scripts */
function client({ reloadTime }: ClientArgs): void {
  const socket: WebSocket = new WebSocket(
    `${ location.protocol === 'https:' ? 'wss' : 'ws' }://${ location.host }/@@/gulp-memory-fs/ws`);

  socket.addEventListener('message', createSocketReloadFunc(reloadTime));
  socket.addEventListener('close', function(event: CloseEvent): void {
    socket.close();
  });
}