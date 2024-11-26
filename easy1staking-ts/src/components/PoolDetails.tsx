import { Box, Card, CardContent, Typography } from "@mui/material";

const PoolDetails = () => {
  return (
    <Box className="my-20 mt-40">
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
            <h1 className="font-semibold text-[25px] text-white mb-10">
              Current Pool
            </h1>
            <Box className="text-white">
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Ticker
                </Typography>
                <Typography className=" text-white">CRDNS</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Lifetime ROA
                </Typography>
                <Typography className=" text-white">3.35%</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  50 Day ROA
                </Typography>
                <Typography className=" text-white">1.79%</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Total Staked
                </Typography>
                <Typography className=" text-white">2,238,505 ADA</Typography>
              </Box>
              <Box className="flex justify-between">
                <Typography variant="body1" className="font-semibold">
                  Margin Fee
                </Typography>
                <Typography className=" text-white">0.00%</Typography>
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
              Easy1
            </h1>
            <Box className="text-white">
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Ticker
                </Typography>
                <Typography className=" text-white">EASY1</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Lifetime ROA
                </Typography>
                <Typography className=" text-white">10000%</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  50 Day ROA
                </Typography>
                <Typography className=" text-white">10000%</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Total Staked
                </Typography>
                <Typography className=" text-white">99,000,000 ADA</Typography>
              </Box>
              <Box className="flex justify-between">
                <Typography variant="body1" className="font-semibold">
                  Margin Fee
                </Typography>
                <Typography className=" text-white">0.00%</Typography>
              </Box>
            </Box>
          </CardContent>
        </div>
      </Box>
    </Box>
  );
}

export default PoolDetails;