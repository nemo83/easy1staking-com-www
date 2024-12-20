import { StakePoolAssessment } from "@/lib/interfaces/AppTypes";
import { Alert, Box, Card, CardContent, Chip, Grid2, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import ReportProblemIcon from '@mui/icons-material/ReportProblem';

const PoolDetails = (props: { stakePoolAssessment: StakePoolAssessment }) => {

  const { stakePoolAssessment } = props;

  const [currentPoolTicker, setCurrentPoolTicker] = useState<string>("N/A");
  const [currentPoolMargin, setCurrentPoolMargin] = useState<number>(0.0);
  const [currentPoolCosts, setCurrentPoolCosts] = useState<number>(0);
  const [currentPoolSaturation, setCurrentPoolSaturation] = useState<number>(0.0);
  const [currentPoolDeclaredPledge, setCurrentPoolDeclaredPledge] = useState<number>(0);
  const [currentPoolRetiring, setCurrentPoolRetiring] = useState<boolean>(false);
  const [currentPoolRetired, setCurrentPoolRetired] = useState<boolean>(false);

  useEffect(() => {
    console.log('PoolDetails stakePoolAssessment: ' + JSON.stringify(stakePoolAssessment));

    if (stakePoolAssessment.current_pool) {
      setCurrentPoolTicker(stakePoolAssessment.current_pool!.ticker);
      setCurrentPoolMargin(stakePoolAssessment.current_pool!.variable);
      setCurrentPoolCosts(stakePoolAssessment.current_pool!.fixed_fee);
      setCurrentPoolSaturation(stakePoolAssessment.current_pool!.saturation);
      setCurrentPoolDeclaredPledge(stakePoolAssessment.current_pool!.declared_pledge);
      setCurrentPoolRetired(stakePoolAssessment.current_pool!.retired);
      setCurrentPoolRetiring(stakePoolAssessment.current_pool!.retiring);
    } else {
      setCurrentPoolTicker("N/A");
      setCurrentPoolMargin(0.0);
      setCurrentPoolCosts(0);
      setCurrentPoolSaturation(0.0);
      setCurrentPoolDeclaredPledge(0);
      setCurrentPoolRetired(false);
      setCurrentPoolRetiring(false);
    }

  }, [stakePoolAssessment])

  const getCurrentPoolRetiredChip = () => {
    if (stakePoolAssessment.current_pool) {
      const currentPool = stakePoolAssessment.current_pool;

      if (currentPool.retiring) {
        console.log('retiring');
        return (
          <Chip label="Retiring" color="warning" size="small" sx={{ pullRight: 1 }} />
        )
      } else if (currentPool.retired) {
        console.log('retired');
        return (
          <Chip label="Retired" color="error" size="small" ></Chip>
        );
      } else {
        return (
          <></>
        )
      }
    } else {
      return (
        <></>
      )
    }
  }

  return (
    <Box className="my-20 mt-40">
      {currentPoolRetiring ?
        <Box marginBottom={4} justifyItems={"center"}>
          <Alert severity="warning"
            sx={{ width: "80%" }}
          > Stake Pool {currentPoolTicker} is retiring soon! Please delegate to a new pool or you will stop receiving rewards </Alert>
        </Box>
        : null}

      {currentPoolRetired ?
        <Box marginBottom={4} justifyItems={"center"}>
          <Alert severity="error"
            sx={{ width: "80%" }}
          > Stake Pool {currentPoolTicker} is RETIRED! Please delegate to a new pool to start receiving rewards again!</Alert>
        </Box>
        : null}


      <Box className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl">
        {/* First Pool Card */}
        <div
          className="relative w-[310px]  md:w-[380px] lg:w-[450px] rounded-lg p-6  border-2 border-[#999999] "
          style={{
            borderWidth: "1px",
            background: "none",
          }}
        >
          <CardContent>
            <Grid2 container justifyContent="space-between">
              <Grid2>
                <h1 className="font-semibold text-[25px] text-white mb-10">
                  Current Pool
                </h1>
              </Grid2>
              {currentPoolRetiring || currentPoolRetired ? <Grid2>
                {getCurrentPoolRetiredChip()}
              </Grid2> : null}
            </Grid2>

            <Box className="text-white">
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Ticker
                </Typography>
                <Typography className=" text-white">{currentPoolTicker}</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Margin %
                </Typography>
                <Typography className=" text-white">{(currentPoolMargin * 100).toFixed(2)}%</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Fixed Costs
                </Typography>
                <Typography className=" text-white">{currentPoolCosts / 1_000_000} Ada</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Saturation
                </Typography>
                <Typography className=" text-white">{(currentPoolSaturation * 100).toFixed(2)} %</Typography>
              </Box>
              <Box className="flex justify-between">
                <Typography variant="body1" className="font-semibold">
                  Pledge
                </Typography>
                <Typography className=" text-white">{(currentPoolDeclaredPledge / 1_000_000).toFixed(0)} Ada</Typography>
              </Box>
            </Box>
          </CardContent>
        </div>
        <div
          className="relative w-[310px]  md:w-[380px] lg:w-[450px] rounded-lg p-6  border-2 border-[#999999] "
          style={{
            borderWidth: "1px",
            background: "none",
          }}
        >
          <CardContent>
            <h1 className="font-semibold  text-[25px] text-white mb-10">
              {stakePoolAssessment.easy1_stake_pool.ticker}
            </h1>
            <Box className="text-white">
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Ticker
                </Typography>
                <Typography className=" text-white">{stakePoolAssessment.easy1_stake_pool.ticker}</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Margin %
                </Typography>
                <Typography className=" text-white">{(stakePoolAssessment.easy1_stake_pool.variable * 100).toFixed(2)}%</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Fixed Costs
                </Typography>
                <Typography className=" text-white">{stakePoolAssessment.easy1_stake_pool.fixed_fee / 1_000_000} Ada</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Saturation
                </Typography>
                <Typography className=" text-white">{(stakePoolAssessment.easy1_stake_pool.saturation * 100).toFixed(2)} %</Typography>
              </Box>
              <Box className="flex justify-between">
                <Typography variant="body1" className="font-semibold">
                  Pledge
                </Typography>
                <Typography className=" text-white">{(stakePoolAssessment.easy1_stake_pool.declared_pledge / 1_000_000).toFixed(0)} Ada</Typography>
              </Box>
            </Box>
          </CardContent>
        </div>
      </Box>
    </Box>
  );
}

export default PoolDetails;