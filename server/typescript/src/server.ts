import { Server, ServerOptions } from "@open-rpc/server-js";
import { HTTPServerTransportOptions } from "@open-rpc/server-js/build/transports/http";
import { WebSocketServerTransportOptions } from "@open-rpc/server-js/build/transports/websocket";
import { OpenrpcDocument } from "@open-rpc/meta-schema";
import { parseOpenRPCDocument } from "@open-rpc/schema-utils-js";
import methodMapping from "./generated-method-mapping";
import doc from "./openrpc.json";
import "./indexer/indexer";

export async function start() {
  const serverOptions: ServerOptions = {
    openrpcDocument: await parseOpenRPCDocument(doc as any),
    transportConfigs: [
      {
        type: "HTTPTransport",
        options: {
          port: process.env.SERVER_HTTP_PORT ? parseInt(process.env.SERVER_HTTP_PORT as string, 10) : 4441,
          middleware: [],
        } as HTTPServerTransportOptions,
      },
      /*{
        type: "WebSocketTransport",
        options: {
          port: process.env.SERVER_WS_PORT || 3331,
          middleware: [],
        } as WebSocketServerTransportOptions,
      },*/
    ],
    methodMapping,
  };

  console.log("Starting Server"); // tslint:disable-line
  const s = new Server(serverOptions);

  s.start();
};