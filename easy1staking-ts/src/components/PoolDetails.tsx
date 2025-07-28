import { StakePoolAssessment } from "@/lib/interfaces/AppTypes";
import { Alert, Box, Card, CardContent, Chip, createTheme, CssBaseline, Grid2, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ThemeProvider, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';

const PoolDetails = (props: { stakePoolAssessment: StakePoolAssessment }) => {

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  const { stakePoolAssessment } = props;

  const [currentPoolTicker, setCurrentPoolTicker] = useState<string>("N/A");
  const [currentPoolMargin, setCurrentPoolMargin] = useState<number>(0.0);
  const [currentPoolCosts, setCurrentPoolCosts] = useState<number>(0);
  const [currentPoolSaturation, setCurrentPoolSaturation] = useState<number>(0.0);
  const [currentPoolDeclaredPledge, setCurrentPoolDeclaredPledge] = useState<number>(0);
  const [currentPoolRetiring, setCurrentPoolRetiring] = useState<boolean>(false);
  const [currentPoolRetired, setCurrentPoolRetired] = useState<boolean>(false);
  const [currentPoolIsMpo, setCurrentPoolIsMpo] = useState<boolean>(false);
  const [showRewardsEstimate, setShowRewardsEstimate] = useState<boolean>(false);

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
      setCurrentPoolIsMpo(stakePoolAssessment.current_pool!.is_mpo);
      const currentPoolLovelacesPerAda = parseFloat(stakePoolAssessment.current_pool!.lovelaces_per_ada);
      const easy1LovelacesPerAda = parseFloat(stakePoolAssessment.easy1_stake_pool.lovelaces_per_ada);
      setShowRewardsEstimate(currentPoolLovelacesPerAda > 0 && currentPoolLovelacesPerAda < easy1LovelacesPerAda);
    } else {
      setCurrentPoolTicker("N/A");
      setCurrentPoolMargin(0.0);
      setCurrentPoolCosts(0);
      setCurrentPoolSaturation(0.0);
      setCurrentPoolDeclaredPledge(0);
      setCurrentPoolRetired(false);
      setCurrentPoolRetiring(false);
      setCurrentPoolIsMpo(false);
      setShowRewardsEstimate(false);
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

  const getCurrentPoolMargin = () => {
    const margin = (currentPoolMargin * 100);
    const easy1Margin = (stakePoolAssessment.easy1_stake_pool.variable * 100);
    if (margin <= easy1Margin) {
      return (
        <Tooltip title="Low margin">
          <Typography color="green">
            {margin.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    } else if (margin < 5.0) {
      return (
        <Tooltip title="High margin. Delegate to EASY1 and increase your rewards">
          <Typography color="yellow">
            {margin.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    } else if (margin < 20.0) {
      return (
        <Tooltip title="Very high marging. Large portion of reward will be lost. Delegate to EASY1 and increase your rewards">
          <Typography color="orange">
            {margin.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="Extremely high margin, majority of reward will be lost. Delegate to EASY1 and increase your rewards">
          <Typography color="red">
            {margin.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    }
  }

  const getCurrentCosts = () => {
    const costs = (currentPoolCosts / 1_000_000);
    if (costs <= 170) {
      return (
        <Tooltip title="Low costs">
          <Typography color="green">
            {costs} Ada
          </Typography>
        </Tooltip>
      );
    } else if (costs <= 340) {
      return (
        <Tooltip title="Higher costs than EASY1. Delegate to EASY1 and increase your rewards">
          <Typography color="yellow">
            {costs} Ada
          </Typography>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="Very high fixed costs">
          <Typography color="red">
            {costs} Ada
          </Typography>
        </Tooltip>
      );
    }
  }

  const getCurrentSaturation = () => {
    const saturation = (currentPoolSaturation * 100); //.toFixed(2)} %
    if (saturation < 3.0) {
      return (
        <Tooltip title="Very low saturation, high chances of epochs without rewards">
          <Typography color="orange">
            {saturation.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    } else if (saturation < 5.0) {
      return (
        <Tooltip title="Low saturation, chances of epochs without rewards">
          <Typography color="yellow">
            {saturation.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    } else if (saturation < 85.0) {
      return (
        <Tooltip title="Ideal saturation">
          <Typography color="green">
            {saturation.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="Very high saturation, chances of losing rewards">
          <Typography color="red">
            {saturation.toFixed(2)} %
          </Typography>
        </Tooltip>
      );
    }
  }

  const getCurrentPledge = () => {
    const pledge = (currentPoolDeclaredPledge / 1_000_000) //.toFixed(0)} Ada
    if (pledge < 1_000) {
      return (
        <Tooltip title="Extremely low pledge, operator has no skin in the game">
          <Typography color="red">
            {pledge.toLocaleString()} Ada
          </Typography>
        </Tooltip>
      );
    } else if (pledge < 20_000) {
      return (
        <Tooltip title="Low skin in the game">
          <Typography color="orange">
            {pledge.toLocaleString()} Ada
          </Typography>
        </Tooltip>
      );
    } else if (pledge < 100_000) {
      return (
        <Tooltip title="SPO has a good amount of skin in the game">
          <Typography color="yellow">
            {pledge.toLocaleString()} Ada
          </Typography>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title="SPO has plenty of sking in the game">
          <Typography color="green">
            {pledge.toLocaleString()} Ada
          </Typography>
        </Tooltip>
      );
    }
  }

  const getCurrentPoolRewardsEstimate = () => {
    return parseFloat(stakePoolAssessment.stake_balance) * parseFloat(stakePoolAssessment.current_pool!.lovelaces_per_ada) / 1_000_000;
  }

  const getEasy1RewardsEstimate = () => {
    return parseFloat(stakePoolAssessment.stake_balance) * parseFloat(stakePoolAssessment.easy1_stake_pool.lovelaces_per_ada) / 1_000_000;
  }

  const getEstimateRewardsIncrease = () => {
    const currentRewards = getCurrentPoolRewardsEstimate();
    const easy1Rewards = getEasy1RewardsEstimate();
    const percentageIncrease = ((easy1Rewards - currentRewards) / currentRewards) * 100;
    return percentageIncrease.toFixed(2);
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
                  {currentPoolTicker}
                  &nbsp;
                  <Typography variant="subtitle1" className="inline">
                    ( Your current pool )
                  </Typography>
                </h1>
              </Grid2>
              {currentPoolRetiring || currentPoolRetired ? <Grid2>
                {getCurrentPoolRetiredChip()}
              </Grid2> : null}
            </Grid2>

            <Box className="text-white">
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Single Pool Owner
                </Typography>
                <Typography className=" text-white">
                  {stakePoolAssessment.current_pool?.is_mpo ?
                    <Tooltip title="Delegating to Multi Pool Operators reduces decentralisation and network security">
                      <DisabledByDefaultIcon color="error" />
                    </Tooltip>
                    : <CheckBoxIcon color="success" />}
                </Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Margin %
                </Typography>
                <Typography className=" text-white">{getCurrentPoolMargin()}</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Fixed Costs
                </Typography>
                <Typography className=" text-white">{getCurrentCosts()}</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Saturation
                </Typography>
                <Typography className=" text-white">{getCurrentSaturation()}</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Pledge
                </Typography>
                <Typography className=" text-white">{getCurrentPledge()}</Typography>
              </Box>
              {showRewardsEstimate ?
                <Box className="flex justify-between">
                  <Typography variant="body1" className="font-semibold">
                    Rewards (estimate)
                  </Typography>
                  <Typography>{(getCurrentPoolRewardsEstimate()).toLocaleString()} Ada</Typography>
                </Box> : null}
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
                  Single Pool Owner
                </Typography>
                <Typography className=" text-white">
                  <CheckBoxIcon color="success" />
                </Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Margin %
                </Typography>
                <Tooltip title="Lowest maring, to maximise your reards">
                  <Typography color="green">{(stakePoolAssessment.easy1_stake_pool.variable * 100).toFixed(2)}%</Typography>
                </Tooltip>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Fixed Costs
                </Typography>
                <Tooltip title="Lowest fixed costs, to maximise your reards">
                  <Typography color="green">{stakePoolAssessment.easy1_stake_pool.fixed_fee / 1_000_000} Ada</Typography>
                </Tooltip>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Saturation
                </Typography>
                <Tooltip title="Low saturation: no risk to lose rewards">
                  <Typography color="green">{(stakePoolAssessment.easy1_stake_pool.saturation * 100).toFixed(2)} %</Typography>
                </Tooltip>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Pledge
                </Typography>
                <Tooltip title="High pledge: SPO has a lot of skin in the game">
                  <Typography color="green">{(stakePoolAssessment.easy1_stake_pool.declared_pledge / 1_000_000).toLocaleString()} Ada</Typography>
                </Tooltip>
              </Box>
              {showRewardsEstimate ?
                <Box className="flex justify-between">
                  <Typography variant="body1" className="font-semibold">
                    Rewards (estimate)
                  </Typography>
                  <Typography color="green">{(getEasy1RewardsEstimate()).toLocaleString()} (+{getEstimateRewardsIncrease()}%) Ada</Typography>
                </Box> : null}
            </Box>
          </CardContent>
        </div>
      </Box>

      {
        false ? <ThemeProvider theme={darkTheme}>
          <CssBaseline />

          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>Ticker</TableCell>
                  <TableCell align="right">Margin %</TableCell>
                  <TableCell align="right">Fixed Costs</TableCell>
                  <TableCell align="right">Saturation</TableCell>
                  <TableCell align="right">Pledge</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow
                  key="easy1"
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {stakePoolAssessment.easy1_stake_pool.ticker}
                  </TableCell>
                  <TableCell align="right">{(stakePoolAssessment.easy1_stake_pool.variable * 100).toFixed(2)} %</TableCell>
                  <TableCell align="right">{stakePoolAssessment.easy1_stake_pool.fixed_fee / 1_000_000} Ada</TableCell>
                  <TableCell align="right">{(stakePoolAssessment.easy1_stake_pool.saturation * 100).toFixed(2)} %</TableCell>
                  <TableCell align="right">{(stakePoolAssessment.easy1_stake_pool.declared_pledge / 1_000_000).toFixed(0)} Ada</TableCell>
                </TableRow>

              </TableBody>
            </Table>
          </TableContainer>
        </ThemeProvider> : null
      }

    </Box >
  );
}

export default PoolDetails;