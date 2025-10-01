import Head from "next/head";
import Scoops from "../../components/Scoops/Scoops";
import ScoopsPies from "../../components/ScoopsPie/ScoopsPie";
import BasicBars from "../../components/ScoopsPeriodicStats/ScoopsPeriodicStats";
import ScoopsCsvDownload from "../../components/ScoopsCsvDownload/ScoopsCsvDownload";
import { Box, Container, createTheme, CssBaseline, Grid2, ThemeProvider, Typography } from "@mui/material";
import Navbar from "@/components/Navbar";

export default function ScooperDashboard() {

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  return (
    <div className="wallet-not-connected min-h-[100vh]">
      <Navbar />
      <div className="h-full flex flex-col justify-center items-center">
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />

          <Grid2 container direction="row" spacing={2} justifyContent={"space-evenly"} alignItems={"center"}>
            <Grid2 >
              <ScoopsPies />
            </Grid2>
            <Grid2 >
              <BasicBars />
            </Grid2>
          </Grid2>
          <ScoopsCsvDownload />
          <Scoops />
        </ThemeProvider>
      </div>
    </div>
  );
}
