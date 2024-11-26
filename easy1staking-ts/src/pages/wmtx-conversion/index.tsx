import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Stack, Alert, Button, FormGroup, FormControlLabel, Checkbox } from "@mui/material";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWallet } from "@meshsdk/react";
import TransactionUtil from "@/lib/util/TransactionUtil";
import toast from "react-hot-toast";
import { EASY1DelegationType } from "@/lib/util/AppTypes";


const WmtConversionPage = () => {

  const WMT_UNIT = "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e776f726c646d6f62696c65746f6b656e";

  const { wallet, connected } = useWallet();

  const [wmtBalance, setWmtBalance] = useState<string>("0");

  const [acceptRisk, setAcceptRisk] = useState<boolean>(false);

  const [acceptFee, setAcceptFee] = useState<boolean>(false);

  const [acceptDelegate, setAcceptDelegate] = useState<boolean>(false);

  const [processingFee, setProcessingFee] = useState<string>("1000000");

  const [delegatedType, setDelegatedType] = useState<EASY1DelegationType>(EASY1DelegationType.ConnectWallet);

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
    }

  }, [connected]);

  useEffect(() => {
    const wmtAmount = parseInt(wmtBalance) / 1_000_000;
    let fee = '1000000';
    if (wmtAmount > 1_000_000) {
      fee = '50000000';
    } else if (wmtAmount > 100_000) {
      fee = '10000000';
    } else if (wmtAmount > 10_000) {
      fee = '5000000';
    }
    setProcessingFee(fee);
  }, [wmtBalance])

  const wmtToWtmx = async () => {
    const unsignedTx = await TransactionUtil.convertWMTtoWTMx(wallet, wmtBalance, processingFee, acceptDelegate ? delegatedType : undefined);
    wallet
      .signTx(unsignedTx)
      .then((signedTx) => wallet.submitTx(signedTx))
      .then((txHash) => toast.success("Transaction submitted: " + txHash.substring(0, 10) + "..." + txHash.substring(txHash.length - 10), { duration: 5000 }))
      .catch((err) => toast.error(err.message, { duration: 5000 }));
  }

  return (
    <div className="wallet-not-connected min-h-[100vh]">
      <Navbar />
      <div className="h-full flex flex-col justify-center items-center">
        <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-16 font-semibold text-center">
          WTMx Conversion
        </h1>

        <Box component={"section"} display="flex" width={"500px"} maxWidth={"60%"} justifyContent={"center"} bgcolor={"lightgray"}
          sx={{
            borderRadius: "20px",
            color: "black"
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
              Convert {parseInt(wmtBalance) / 1_000_000} WMT to WTMx
            </Button>
            <Alert severity="warning">Use this tool at your own risk! No responsibility are taken if the tool is use improperly
              or if funds while using this conversion tool</Alert>
            <Alert severity="info">Please note that it is possible to convert WMT to WTMx only on Cardano Network.</Alert>
            <Alert severity="info">A small fee is charged for every transaction depending on the amount of WMT converted.</Alert>
          </Stack>
        </Box>

      </div>
      <div className="mt-20">
        <Footer />
      </div>
    </div>
  );
}

export default WmtConversionPage;
