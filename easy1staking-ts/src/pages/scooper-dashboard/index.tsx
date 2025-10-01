import Head from "next/head";
import Scoops from "../../components/Scoops/Scoops";
import ScoopsPies from "../../components/ScoopsPie/ScoopsPie";
import BasicBars from "../../components/ScoopsPeriodicStats/ScoopsPeriodicStats";
import ScoopsCsvDownload from "../../components/ScoopsCsvDownload/ScoopsCsvDownload";
import { Box, Container, createTheme, CssBaseline, Grid2, ThemeProvider, Typography } from "@mui/material";
import Navbar from "@/components/Navbar";

export default function ScooperDashboard() {

  const sundaeTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#F070D0', // Sundae pink
        light: '#FF9DE6',
        dark: '#D44BB8',
      },
      secondary: {
        main: '#A855F7', // Purple
        light: '#C084FC',
        dark: '#7E22CE',
      },
      background: {
        default: '#0F0A1E', // Deep purple-black
        paper: '#1A1329', // Dark purple
      },
      text: {
        primary: '#FFFFFF',
        secondary: '#D1C4E9',
      },
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
      h4: {
        fontWeight: 700,
        background: 'linear-gradient(135deg, #F070D0 0%, #A855F7 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      },
      h6: {
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#1A1329',
            boxShadow: '0 4px 20px rgba(240, 112, 208, 0.2)',
            border: '1px solid rgba(240, 112, 208, 0.2)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 12,
          },
          contained: {
            background: 'linear-gradient(135deg, #F070D0 0%, #A855F7 100%)',
            boxShadow: '0 4px 12px rgba(240, 112, 208, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #FF9DE6 0%, #C084FC 100%)',
              boxShadow: '0 6px 16px rgba(240, 112, 208, 0.5)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: 'rgba(240, 112, 208, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(240, 112, 208, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#F070D0',
              },
            },
          },
        },
      },
    },
  });

  return (
    <div className="min-h-[100vh]" style={{
      background: 'linear-gradient(180deg, #0F0A1E 0%, #1A0B2E 50%, #2D1B4E 100%)'
    }}>
      <Navbar />
      <div className="h-full flex flex-col justify-center items-center py-8">
        <ThemeProvider theme={sundaeTheme}>
          <CssBaseline />

          <Container maxWidth="xl">
            <Box sx={{ textAlign: 'center', mb: 6, mt: 4 }}>
              <Typography variant="h4" component="h1" sx={{ mb: 2, fontSize: '2.5rem' }}>
                Scooper Analytics Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                Track DEX scooper performance - one scoop at a time 🍦
              </Typography>
            </Box>

            <Grid2 container direction="row" spacing={3} justifyContent={"center"} alignItems={"flex-start"} sx={{ mb: 4 }}>
              <Grid2>
                <ScoopsPies />
              </Grid2>
              <Grid2>
                <BasicBars />
              </Grid2>
            </Grid2>

            <ScoopsCsvDownload />
            <Scoops />
          </Container>
        </ThemeProvider>
      </div>
    </div>
  );
}
