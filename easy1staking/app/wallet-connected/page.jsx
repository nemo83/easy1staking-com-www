import React from "react";
import Navbar from "../components/Navbar";
import { Box, Card, CardContent, Typography } from "@mui/material";
import Footer from "../components/Footer";

function page() {
  return (
    <div className="wallet-not-connected min-h-[100vh]">
      <Navbar wallet={true} />
      <div className="h-full flex flex-col justify-center items-center">
        <h1 className="text-[34px] sm:text-[54px] md:text-[64px] py-16 font-semibold text-center">
          You’ve earned 2,000,000 ADA while staking with Easy1
        </h1>
        <div
          className="relative w-[80%]  md:w-[70%] rounded-lg p-6   border-2 border-[#999999] "
          style={{
            borderWidth: "1px",
            background: "none",
          }}
        >
          <CardContent>
            <Box className="text-white">
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Label
                </Typography>
                <Typography className=" text-white">Data</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Label
                </Typography>
                <Typography className=" text-white">Data</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Label
                </Typography>
                <Typography className=" text-white">Data</Typography>
              </Box>
              <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                <Typography variant="body1" className="font-semibold">
                  Label
                </Typography>
                <Typography className=" text-white">Data</Typography>
              </Box>
              <Box className="flex justify-between">
                <Typography variant="body1" className="font-semibold">
                  Label
                </Typography>
                <Typography className=" text-white">Data</Typography>
              </Box>
            </Box>
          </CardContent>
        </div>
      </div>
      <div className="mt-20">
        <Footer />
      </div>
    </div>
  );
}

export default page;
