import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import CheckIcon from '@mui/icons-material/Check';
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { Button, Collapse } from "@mui/material";
import LaunchIcon from '@mui/icons-material/Launch';
import { EASY1STAKING_API } from "@/lib/util/Constants";
type Scoop = {
  timestamp: number;
  txHash: string;
  numOrders: number;
  scooperHash: string;
  isMempool: boolean;
};

const Scoops = () => {
  const [scoops, setScoops] = React.useState<Scoop[]>([]);
  const stompClientRef = React.useRef<any>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = React.useCallback(() => {
    try {
      const socket = new SockJS(`${EASY1STAKING_API}/ws`);
      const stompClient = Stomp.over(socket);

      // Disable debug logging
      stompClient.debug = () => {};

      stompClientRef.current = stompClient;

      stompClient.connect(
        {},
        (frame: any) => {
          console.log("WebSocket Connected: " + frame);
          stompClient.subscribe("/topic/messages", (messageOutput: any) => {
            try {
              console.log("ws: " + JSON.stringify(messageOutput.body));
              const serverScoop = JSON.parse(messageOutput.body);
              const scoop: Scoop = {
                timestamp: serverScoop.timestamp / 1_000,
                txHash: serverScoop.tx_hash,
                numOrders: serverScoop.num_orders,
                scooperHash: serverScoop.scooper_hash,
                isMempool: serverScoop.is_mempool
              };

              setScoops((oldScoops) => [scoop].concat(oldScoops.slice(0, 9)));
            } catch (error) {
              console.error("Error processing message:", error);
            }
          });
        },
        (error: any) => {
          console.error("WebSocket connection error:", error);
          // Attempt to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("Attempting to reconnect WebSocket...");
            connectWebSocket();
          }, 5000);
        }
      );
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect WebSocket...");
        connectWebSocket();
      }, 5000);
    }
  }, []);

  React.useEffect(() => {
    // Fetch initial data
    fetch(
      `${EASY1STAKING_API}/scoops?` +
      new URLSearchParams({ sort: "DESC", limit: "10" }).toString()
    )
      .then((res) => res.json())
      .then((data) => {
        const foo: Scoop[] = data.map((s: any) => ({
          timestamp: s.timestamp,
          txHash: s.tx_hash,
          numOrders: s.num_orders,
          scooperHash: s.scooper_hash,
          isMempool: s.is_mempool,
        }));

        setScoops(foo);
        // Connect WebSocket after initial data is loaded
        connectWebSocket();
      })
      .catch((error) => {
        console.error("Error fetching initial scoops:", error);
        // Still try to connect WebSocket even if initial fetch fails
        connectWebSocket();
      });

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.disconnect(() => {
          console.log("WebSocket disconnected");
        });
      }
    };
  }, [connectWebSocket]);

  const trimTxHash = (hash: string) => {
    return `${hash.substring(0, 5)}...${hash.substring(hash.length - 5)}`;
  };

  return (
    <TableContainer component={Paper} sx={{ maxWidth: 1200, margin: '2rem auto' }}>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell align="left">Transaction Hash</TableCell>
            <TableCell align="left">Number Orders</TableCell>
            <TableCell align="left">Scooper Hash</TableCell>
            <TableCell align="left">Mempool</TableCell>
          </TableRow>
        </TableHead>
        <TransitionGroup component={TableBody}>
          {scoops.map((scoop) => (
            <CSSTransition key={scoop.txHash} timeout={500} classNames="fade">
              <TableRow>
                <TableCell>{new Date(scoop.timestamp * 1000).toLocaleString()}</TableCell>
                <TableCell align="left">
                  <Button href={"https://cardanoscan.io/transaction/" + scoop.txHash}
                    endIcon={<LaunchIcon />}                                        >
                    {trimTxHash(scoop.txHash)}
                  </Button>
                </TableCell>
                <TableCell align="left">{scoop.numOrders}</TableCell>
                <TableCell align="left">
                  {scoop.scooperHash ===
                    "37eb116b3ff8a70e4be778b5e8d30d3b40421ffe6622f6a983f67f3f"
                    ? "EASY1"
                    : scoop.scooperHash}
                </TableCell>
                <TableCell align="left">{scoop.isMempool ? <CheckIcon /> : ''}</TableCell>
              </TableRow>
            </CSSTransition>
          ))}
        </TransitionGroup>
      </Table>
    </TableContainer>

  );
};

export default Scoops;
