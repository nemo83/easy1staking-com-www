import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import Image from "next/image";
import TheMandrillz from "../assets/TheMandrillz.png";
import VerifiedRounded from "../assets/VerifiedRounded.png";

function NFTHero() {
  return (
    <div>
      <h1 className="text-[34px] sm:text-[54px] md:text-[64px] pt-20 mb-10 font-semibold text-center">
        NFT Raffle
      </h1>
      <div className="flex justify-center">
        <Box className="my-20">
          <Box className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl">
            {/* First Pool Card */}
            <div
              className="relative w-[310px]   md:w-[380px] lg:w-[450px]  "
              style={{
                background: "none",
                boxShadow: "none",
              }}
            >
              <Image
                src={TheMandrillz}
                alt="nft"
                className="h-full object-cover rounded-3xl "
              />
            </div>
            <div
              className="relative w-[310px]  md:w-[380px] lg:w-[450px] rounded-3xl p-3   border-2 border-[#999999] "
              style={{
                borderWidth: "1px",
                background: "none",
              }}
            >
              <CardContent>
                <h1 className=" text-[30px] font-semibold text-white mb-3">
                  TheMandrillz #1013
                </h1>
                <h1
                  variant="h6"
                  className=" text-white mb-5 flex  items-center"
                >
                  The Mandrillz{" "}
                  <Image src={VerifiedRounded} className="w-5 ms-2" alt="nft" />
                </h1>
                <Typography variant="h7" className=" text-white font-normal ">
                  This is a collection of 8888 unique Mandrillz. A meteor
                  strikes near a zoo and the mandrill enclosure is largely
                  destroyed....
                </Typography>
                <Box className="text-white mt-10">
                  <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                    <h1 className="font-semibold">
                      Wen
                    </h1>
                    <h1 className=" text-white">Expired</h1>
                  </Box>
                  <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                    <h1 className="font-semibold">
                      Tickets
                    </h1>
                    <h1 className=" text-white">0/10</h1>
                  </Box>
                  <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                    <h1 className="font-semibold">
                      My Entries
                    </h1>
                    <h1 className=" text-white">0/3</h1>
                  </Box>
                  <Box className="flex justify-between mb-6 pb-1 border-b border-dotted border-[#999999]">
                    <h1 className="font-semibold">
                      Status
                    </h1>
                    <h1 className=" text-white">Drawing Winner</h1>
                  </Box>
                </Box>
              </CardContent>
            </div>
          </Box>
        </Box>
      </div>
    </div>
  );
}

export default NFTHero;
