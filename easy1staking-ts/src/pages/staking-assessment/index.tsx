import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Distribution from "@/components/Distribution";
import { CssBaseline } from "@mui/material";

const WmtConversionPage = () => {

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });


  return (
    <div className="wallet-not-connected min-h-[100vh]">
      <Navbar />
      <div className="h-full flex flex-col justify-center items-center">
        <Distribution />

      </div>
    </div >
  );
}

export default WmtConversionPage;
