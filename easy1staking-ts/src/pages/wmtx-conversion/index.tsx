import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Stack, Alert, Button, FormGroup, FormControlLabel, Checkbox, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody, CardHeader, Avatar, Grid, Grid2, CssBaseline } from "@mui/material";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWallet } from "@meshsdk/react";
import TransactionUtil from "@/lib/util/TransactionUtil";
import toast from "react-hot-toast";
import { EASY1STAKING_API } from "@/lib/util/Constants";
import { EASY1DelegationType, WmtConversionStats, WmtConversion } from "@/lib/interfaces/AppTypes";
import Link from "next/link";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const WmtConversionPage = () => {

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  const WMT_UNIT = "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e776f726c646d6f62696c65746f6b656e";

  const { wallet, connected } = useWallet();

  const [wmtBalance, setWmtBalance] = useState<string>("0");

  const [acceptRisk, setAcceptRisk] = useState<boolean>(false);

  const [acceptFee, setAcceptFee] = useState<boolean>(false);

  const [acceptDelegate, setAcceptDelegate] = useState<boolean>(false);

  const [processingFee, setProcessingFee] = useState<string>("1000000");

  const [delegatedType, setDelegatedType] = useState<EASY1DelegationType>(EASY1DelegationType.ConnectWallet);

  const [wmtConversions, setWmtConversions] = useState<WmtConversion[]>([]);

  const [wmtConversionStats, setWmtConversionStats] = useState<WmtConversionStats>({
    num_conversions_total: 0,
    amount_wmt_converted_total: 0
  });

  useEffect(() => {

    if (connected) {

      wallet.getBalance()
        .then((balance) => balance.filter((asset) => asset.unit === WMT_UNIT))
        .then((wmtAmount) => {
          if (wmtAmount.length > 0) {
            setWmtBalance(wmtAmount[0].quantity);
          } else {
            setWmtBalance("0");
          }
        });

      wallet
        .getRewardAddresses()
        .then((rewardAddresses) => {
          if (!rewardAddresses) {
            console.log('no reward addresses')
            return Promise.resolve(EASY1DelegationType.UnsupportedWallet)
          } else {
            console.log('rewards addresses: ' + JSON.stringify(rewardAddresses));
            const stakeAddress = rewardAddresses.shift()!;
            return TransactionUtil.canBeDelegated(stakeAddress)
          }
        })
        .then(delegatedType => {
          console.log('delegatedType: ' + delegatedType)
          setDelegatedType(delegatedType)
        })


    } else {
      setDelegatedType(EASY1DelegationType.ConnectWallet)
      setWmtBalance("0");
    }

  }, [connected]);

  useEffect(() => {
    const wmtAmount = parseInt(wmtBalance) / 1_000_000;
    let fee = '1000000';
    if (wmtAmount >= 1_000_000) {
      fee = '50000000';
    } else if (wmtAmount >= 100_000) {
      fee = '10000000';
    } else if (wmtAmount >= 10_000) {
      fee = '5000000';
    }
    setProcessingFee(fee);
  }, [wmtBalance])

  useEffect(() => {
    fetch(EASY1STAKING_API + '/wmt_conversions/stats')
      .then(response => response.json())
      .then((data: WmtConversionStats) => {
        console.log('data: ' + JSON.stringify(data));
        setWmtConversionStats(data);
      })
  }, [])

  useEffect(() => {
    fetch(EASY1STAKING_API + '/wmt_conversions')
      .then(response => response.json())
      .then((data: WmtConversion[]) => {
        console.log('data: ' + JSON.stringify(data));
        setWmtConversions(data);
      })
  }, [])

  const wmtToWtmx = async () => {
    TransactionUtil
      .convertWMTtoWTMx(wallet, wmtBalance, processingFee, acceptDelegate ? delegatedType : undefined)
      .then((unsignedTx) => {
        return wallet
          .signTx(unsignedTx)
          .then((signedTx) => wallet.submitTx(signedTx))
          .then((txHash) => toast.success("Transaction submitted: " + txHash.substring(0, 10) + "..." + txHash.substring(txHash.length - 10), { duration: 5000 }))
          .catch((err) => toast.error(err.message, { duration: 5000 }));
      })
      .catch((err) => toast.error(err, { duration: 5000 }));

  }

  return (
    <div className="wallet-not-connected min-h-[100vh]">
      <Navbar />
      <div className="h-full flex flex-col justify-center items-center">
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />

          <Typography variant="h2" fontWeight={"bold"}
            sx={{
              paddingTop: 12,
              paddingBottom: 4
            }}
          >
            WMT Conversion
          </Typography>

          <Grid2 container spacing={2} justifyContent={"space-between"} paddingBottom={4} width={"600px"} maxWidth={"60%"} >
            <Grid2 >
              <Box sx={{ border: 2, borderColor: "#999999", borderRadius: "20px" }}>
                <Card sx={{ background: "none" }}>
                  <CardHeader
                    avatar={<Avatar><SwapVertIcon /></Avatar>}
                    title={wmtConversionStats.num_conversions_total}
                    subheader="Num Conversions"
                  >
                  </CardHeader>
                </Card>
              </Box>
            </Grid2>
            <Grid2>
              <Box sx={{ border: 2, borderColor: "#999999", borderRadius: "20px" }}>
                <Card sx={{ background: "none" }}>
                  <CardHeader
                    avatar={<Avatar><AttachMoneyIcon /></Avatar>}
                    title={wmtConversionStats.amount_wmt_converted_total / 1_000_000}
                    subheader="WMT Converted"
                  >
                  </CardHeader>
                </Card>
              </Box>
            </Grid2>
          </Grid2>

          <Box component={"section"} display="flex" width={"600px"} maxWidth={"60%"} justifyContent={"center"}
            sx={{
              border: "2px solid white",
              borderRadius: "20px",
            }}
          >
            <Stack spacing={2} margin={2} width={"70%"}>
              <FormGroup>
                <FormControlLabel required control={<Checkbox />} label="I accept to use this tool at my own risk"
                  value={acceptRisk}
                  onChange={() => setAcceptRisk(!acceptRisk)}
                />
                <FormControlLabel required control={<Checkbox />} label={`I accept to pay (${parseInt(processingFee) / 1_000_000} ada) conversion fees along with transaction fees`}
                  value={acceptFee}
                  onChange={() => setAcceptFee(!acceptFee)}
                />
                {delegatedType == EASY1DelegationType.Unregistered || delegatedType == EASY1DelegationType.DelegatedOther ?
                  <FormControlLabel control={<Checkbox />} label="I'm thankful for your service, and will gladly delegate to EASY1 Stake Pool"
                    value={acceptDelegate}
                    onChange={() => setAcceptDelegate(!acceptDelegate)}
                  /> : null}
              </FormGroup>
              <Button variant="contained"
                disabled={!connected || !acceptFee || !acceptRisk || parseInt(wmtBalance) == 0}
                onClick={() => wmtToWtmx()}>
                Convert {parseInt(wmtBalance) / 1_000_000} WMT to WMTx
              </Button>
              <Alert severity="warning">Use this tool at your own risk! No responsibility are taken if the tool is use improperly
                or if funds are lost while using this conversion tool</Alert>
              <Alert severity="info">If you&apos;ve just setup a new wallet, please set up some collateral or send additional 5 ada to this wallet&apos;s receiving address.</Alert>
              <Alert severity="info">Please note that it is possible to convert WMT to WMTx only on the Cardano Network.</Alert>
              <Alert severity="info">A small fee is charged for every transaction depending on the amount of WMT converted.</Alert>
              <Alert severity="info">If you get a &quot;Utxo Already Spent&quot;, wait a couple of minutes and refresh the page.</Alert>
            </Stack>
          </Box>

          <div className="h-full flex flex-col justify-center items-center">
            <Typography variant="h2" fontWeight={"bold"}
              sx={{
                paddingY: 8
              }}
            >
              Recent Transactions
            </Typography>
          </div>
          <Stack spacing={2}
            width={"600px"}
            maxWidth={"60%"}
            alignItems={"center"}
            border={"2px solid white"}
            borderRadius={"20px"}
          >
            <TableContainer component={Paper} sx={{ width: "90%" , background: "none" }}>
              <Table aria-label="simple table">
                <TableHead>
                  <TableRow>
                    <TableCell component={"th"}>Tx Hash</TableCell>
                    <TableCell component={"th"} align="right">Amt WMT Converted</TableCell>
                    <TableCell component={"th"} align="right">Tx Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wmtConversions.map((row) => (
                    <TableRow
                      key={row.tx_hash}
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        <Link href={"https://cardanoscan.io/transaction/" + row.tx_hash}>
                          {row.tx_hash.substring(0, 10) + "..." + row.tx_hash.substring(row.tx_hash.length - 10)} <OpenInNewIcon />
                        </Link>
                      </TableCell>
                      <TableCell align="right">{row.amount_wmt_converted / 1_000_000}</TableCell>
                      <TableCell align="right">{row.tx_time}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>

        </ThemeProvider >
      </div>
      <div className="mt-20">
        <Footer />
      </div>
    </div >
  );
}

export default WmtConversionPage;
