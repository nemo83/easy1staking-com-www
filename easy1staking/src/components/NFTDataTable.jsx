import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import Tooltip from "@mui/material/Tooltip";
import Trait1 from "../assets/Trait1.png";
import Trait2 from "../assets/Trait2.png";
import Trait3 from "../assets/Trait3.png";
import Trait4 from "../assets/Trait4.png";
import Trait5 from "../assets/Trait5.png";
import Image from "next/image";

const createData = (id, trait, collection, name, winner) => {
  return { id, trait, collection, name, winner };
};

const rows = [
  createData(1, Trait1, "CryptoPunks", "Punk #7804", "stake1u86f8f"),
  createData(2, Trait2, "Bored Ape Yacht Club", "Ape #5001", "stake2u86f8f"),
  createData(4, Trait3, "World of Women", "WoW #101", "stake4u86f8f"),
  createData(5, Trait4, "Doodles", "Doodle #256", "stake5u86f8f"),
  createData(6, Trait5, "Art Blocks", "Genesis", "stake3u86f8f"),
];

const NFTDataTable = () => {
  return (
    <TableContainer
      component={Paper}
      className="bg-transparent rounded-lg shadow-lg "
      style={{ background: "none" }}
    >
      <Table>
        <TableHead className="mb-10">
          <TableRow>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <span className="text-white border px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Trait
                </span>
              </div>
            </TableCell>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <div className="text-white border px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Collection
                </div>
              </div>
            </TableCell>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <span className="text-white border px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Name
                </span>
              </div>
            </TableCell>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <span className="text-white border px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Winner
                </span>
              </div>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="hover:bg-[#ffffff09]  transition duration-300"
              sx={{ color: "white" }}
            >
              <TableCell
                component="th"
                scope="row"
                padding="none"
                sx={{ borderColor: "#666666" }}
              >
                <div className="text-white flex justify-center   font-semibold  p-4">
                  <Image
                    src={row.trait}
                    alt="nft"
                    className="w-24 rounded-3xl h-24"
                  />
                </div>
              </TableCell>
              <TableCell sx={{ borderColor: "#666666" }}>
                <div className="text-white text-center  font-semibold  pb-4">
                  {row.collection}
                </div>
              </TableCell>
              <TableCell sx={{ borderColor: "#666666" }}>
                <div className="text-white text-center  font-semibold  pb-4">
                  {row.name}
                </div>
              </TableCell>
              <TableCell sx={{ borderColor: "#666666" }}>
                <Tooltip title={row.winner} arrow>
                  <div className="text-center font-semibold pb-4">
                    <div className="text-[#82B1FF]  h-10 flex justify-center items-end">
                      {row.winner.slice(0, 6) + "..." + row.winner.slice(-3)}
                    </div>
                  </div>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default NFTDataTable;
