// DataTable.jsx
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

const createData = (id, epoch, winner, prize, tx, status) => {
  return { id, epoch, winner, prize, tx, status };
};

const rows = [
  createData(
    1,
    450,
    "stake1u86f8f",
    "10m $CULO",
    "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
    "Success"
  ),
  createData(
    2,
    450,
    "stake1u86f8f",
    "20 $WMT",
    "a2c6b1d7f6213c78e83f21ebbc89c751f38c9b90f50bb3d80a1e1e57c5e4f25e",
    "Success"
  ),
  createData(
    3,
    450,
    "stake1u86f8f",
    "15 $ADA",
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "Success"
  ),
  createData(
    4,
    449,
    "stake1u86f8f",
    "10m $CULO",
    "d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
    "Success"
  ),
  createData(
    5,
    449,
    "stake1u86f8f",
    "5 $ADA",
    "c6b5e9ef7076502f20b8e2e9f8eb113f9c6c0e0f7f58c3cda4931d5d648e74bc",
    "Success"
  ),
  createData(
    6,
    448,
    "stake1u86f8f",
    "10m $CULO",
    "b1a4a1e5b4c674f79e1c3a45b9823d7c3c6d3a27d9e236dc7f4e7e5d83b7b2b5",
    "Success"
  ),
  createData(
    7,
    448,
    "stake1u86f8f",
    "10 $WMT",
    "c23f6c7d4c456b2f7e96a891e95e6b9fa25e61a7633e2e41fa70580a4f2f2c34",
    "Success"
  ),
  createData(
    8,
    448,
    "stake1u86f8f",
    "5 $ADA",
    "6d1b7f819e412b992cb5a465b69bfe4c32b96ef5696a6f5e4b8b7afca8c9d67b",
    "Success"
  ),
  createData(
    9,
    447,
    "stake1u86f8f",
    "10m $CULO",
    "e8a0d75eddfc19d97f33b97e76da85c005c0b25b68b6d3b5f2b3a3fefbb9c6b5",
    "Success"
  ),
  createData(
    10,
    447,
    "stake1u86f8f",
    "5 $ADA",
    "b8d3f41f0e4e2647c2dbda1f1f1c8a2b8d3f419de20f5d23b99e8b121f91bbf8",
    "Success"
  ),
  createData(
    11,
    446,
    "stake1u86f8f",
    "10m $CULO",
    "4e1f236b3d67f37ed0b34f440b3dc8b1e0c1c0a2b5c7f7f1b4c2c3e3a2b1d9d3",
    "Success"
  ),
  createData(
    12,
    446,
    "stake1u86f8f",
    "10 $WMT",
    "5d7e2c5fce1f2e421f71d0c75182bcf0b7613c82f5c2a3b4c3b36b3e4e2a8e63",
    "Success"
  ),
  createData(
    13,
    446,
    "stake1u86f8f",
    "15 $ADA",
    "16c5a3f70a465c565f10ab31735b7db3b5c36221d7484d156f4e8721d1d555c7",
    "Success"
  ),
  createData(
    14,
    445,
    "stake1u86f8f",
    "10m $CULO",
    "a3d3e343b71e8b715de10a1726b9a8ec8ff00ef3e2bc9174fef37cfc442c9d30",
    "Success"
  ),
  createData(
    15,
    445,
    "stake1u86f8f",
    "5 $ADA",
    "7f4b5a51594ab4da40c603c8d60d65b5f4c6c2b2b2c3c3b6f3d9a1b3e8a5f42b",
    "Success"
  ),
  createData(
    16,
    444,
    "stake1u86f8f",
    "10m $CULO",
    "d6b5f1a48f9f95c16f3e761d834d7d2d161c0f5b4f3b1c0d9243e8e5c6b1f5b7",
    "Success"
  ),
  createData(
    17,
    444,
    "stake1u86f8f",
    "10 $WMT",
    "2b8e24b794b8c7b6d6bff9e8435c1f24deaf4b5a52436a58eabf7e29a7e6bde8",
    "Success"
  ),
  createData(
    18,
    444,
    "stake1u86f8f",
    "15 $ADA",
    "4a5e5c6d0d0d66d3c9a0a7c13e22e1f3d648ef5e0d2b7c3b2b2f0e1d5f4a1b5b",
    "Success"
  ),
  createData(
    19,
    443,
    "stake1u86f8f",
    "10m $CULO",
    "bc25d0b36f4d3e74f8451c1e2d2e12b857646e501df3f1e79827c8d6dbac2e0b",
    "Success"
  ),
  createData(
    20,
    443,
    "stake1u86f8f",
    "5 $ADA",
    "a9d6c0c0b7167b5b25600bb7637334e7f5e3f5002b8edc79cbf8eaa963c9f576",
    "Success"
  ),
  createData(
    21,
    442,
    "stake1u86f8f",
    "10m $CULO",
    "b25f8f408c6d743c3f3c74b4e1bbaaf62f3e5c5a50c2a5a6b3f2b6f763f2d7cf",
    "Success"
  ),
  createData(
    22,
    442,
    "stake1u86f8f",
    "10 $WMT",
    "fb86fdfd6cc0c87f28e9a9e1dbbd32e9e0ff885d737e2c55e0bce0ff1e79a2e0",
    "Success"
  ),
  createData(
    23,
    442,
    "stake1u86f8f",
    "5 $ADA",
    "3e5b14ffaf2a104b2a7de233d249bdc20c1f2d9c8b32bde65bce16b5c9bcb230",
    "Success"
  ),
  createData(
    24,
    441,
    "stake1u86f8f",
    "10m $CULO",
    "c6164f1f4e9b879bc3e4874a53c8b6c5ff10b79de77672d564eb8c2b8e5f7df0",
    "Success"
  ),
  createData(
    25,
    441,
    "stake1u86f8f",
    "10 $WMT",
    "e13a4cda62cd3b37f4f2765d8f867d2fbe7b005cb7dcffdebc36d2d1a6e7f7d5",
    "Success"
  ),
  createData(
    26,
    441,
    "stake1u86f8f",
    "5 $ADA",
    "9c1b3a3e6ae6e77b34b9c8a8c4b29c8f71bfb5a64d60749c062f16bc8b245f88",
    "Success"
  ),
  createData(
    27,
    440,
    "stake1u86f8f",
    "10m $CULO",
    "0d2c2a5c3db2a9b1a6f0a2b8f0d5d1f4e60a4f9d11e4bbd6d3ff42f9b7e0e9e6",
    "Success"
  ),
  createData(
    28,
    440,
    "stake1u86f8f",
    "10 $WMT",
    "1c8f73a7c78e8e0f803a785eaf9a32c705842fe4e9c5a9edab0de38ae847e239",
    "Success"
  ),
  createData(
    29,
    440,
    "stake1u86f8f",
    "5 $ADA",
    "78be5c0c3a30b1d8d40eae9d1fcb98bda5c9b06210cb0a2f077eff83bc1f7b00",
    "Success"
  ),
  createData(
    30,
    439,
    "stake1u86f8f",
    "10m $CULO",
    "92c3be8e4a4b2d4a8b0ff2a3e9bc9c6e5a4d879e6eb6370a0a1afefc3be1122c",
    "Success"
  ),
];
const DataTable = () => {
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
                <span className="text-white border text-center px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Epoch
                </span>
              </div>
            </TableCell>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <div className="text-white border px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Winner
                </div>
              </div>
            </TableCell>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <span className="text-white border px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Prize
                </span>
              </div>
            </TableCell>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <span className="text-white border px-6 inline-block mb-10 py-2 font-semibold rounded-xl">
                  Tx
                </span>
              </div>
            </TableCell>
            <TableCell sx={{ border: "none" }}>
              <div className="flex justify-center ">
                <span className="text-white border px-6 py-2 inline-block mb-10 font-semibold rounded-xl">
                  Status
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
                <div className="text-white text-center font-semibold p-4">
                  {row.epoch}
                </div>
              </TableCell>
              <TableCell sx={{ borderColor: "#666666" }}>
                <div className="text-[#82B1FF] text-center  font-semibold pb-4">
                  {row.winner}
                </div>
              </TableCell>
              <TableCell sx={{ borderColor: "#666666" }}>
                <div className="text-white text-center  font-semibold  pb-4">
                  {row.prize}
                </div>
              </TableCell>
              <TableCell sx={{ borderColor: "#666666" }}>
                <div className="text-center  font-semibold  pb-4">
                  <Tooltip title={row.tx} arrow>
                    <div className="text-[#82B1FF]  h-10 flex justify-center items-end">
                      {row.tx.slice(0, 6) + "..." + row.tx.slice(-3)}
                    </div>
                  </Tooltip>
                </div>
              </TableCell>
              <TableCell sx={{ borderColor: "#666666" }}>
                <div className="text-white text-center  font-semibold  pb-4">
                  {row.status}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DataTable;
