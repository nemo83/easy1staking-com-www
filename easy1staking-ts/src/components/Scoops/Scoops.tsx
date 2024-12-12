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
type Scoop = {
  timestamp: number;
  txHash: string;
  numOrders: number;
  scooperHash: string;
  isMempool: boolean;
};

const Scoops = () => {
  const [scoops, setScoops] = React.useState<Scoop[]>([]);

  React.useEffect(() => {
    (async () => {
      fetch(
        "https://scooper-api.easy1staking.com/scoops?" +
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
          return Promise.resolve(0);
        })
        .then((data) => {

          var socket = new SockJS("https://scooper-api.easy1staking.com/ws");
          const stompClient = Stomp.over(socket);
          stompClient.connect({}, function (frame: any) {
            console.log("Connected: " + frame);
            stompClient.subscribe("/topic/messages", function (messageOutput: any) {
              console.log("ws: " + JSON.stringify(messageOutput.body));
              const serverScoop = JSON.parse(messageOutput.body);
              const scoop: Scoop = {
                timestamp: serverScoop.timestamp,
                txHash: serverScoop.tx_hash,
                numOrders: serverScoop.num_orders,
                scooperHash: serverScoop.scooper_hash,
                isMempool: serverScoop.is_mempool,
              };

              setScoops((oldScoops) => oldScoops.slice().concat(scoop));
            });
          });

        });
    })();
  }, []);



  const add = () => {
    let scoop = scoops.at(0);
    if (scoop != null) {
      let newScoop = { ...scoop, txHash: scoop.txHash + "a" };
      const newScoops = [newScoop].concat(scoops);
      setScoops((oldScoops) => [newScoop].concat(oldScoops.slice()));
    }
  };

  const trimTxHash = (hash: string) => {
    return `${hash.substring(0, 5)}...${hash.substring(hash.length - 5)}`;
  };

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
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
