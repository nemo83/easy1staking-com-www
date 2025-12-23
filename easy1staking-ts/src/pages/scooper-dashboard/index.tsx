import Head from "next/head";
import { useState, useEffect } from "react";
import Scoops from "../../components/Scoops/Scoops";
import ScoopsPies from "../../components/ScoopsPie/ScoopsPie";
import BasicBars from "../../components/ScoopsPeriodicStats/ScoopsPeriodicStats";
import ScoopsCsvDownload from "../../components/ScoopsCsvDownload/ScoopsCsvDownload";
import ScooperBalances from "../../components/ScooperBalances/ScooperBalances";
import ProtocolAnalytics from "../../components/ProtocolAnalytics/ProtocolAnalytics";
import { Box, Container, createTheme, CssBaseline, Grid2, ThemeProvider, Typography, Tabs, Tab, FormControl, Select, MenuItem, InputLabel, Divider } from "@mui/material";
import Navbar from "@/components/Navbar";
import { getScooperName, EASY1STAKING_API } from "@/lib/util/Constants";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`scooper-tabpanel-${index}`}
      aria-labelledby={`scooper-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

type PoolOption = {
  hash: string;
  name: string;
  scoops: number;
};

export default function ScooperDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPool, setSelectedPool] = useState<string>('all');
  const [timePeriod, setTimePeriod] = useState<number>(7);
  const [poolOptions, setPoolOptions] = useState<PoolOption[]>([]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Fetch pool options
  useEffect(() => {
    fetch(`${EASY1STAKING_API}/scoops/stats/P1D`)
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data.scooper_stats]
          .sort((a: any, b: any) => b.total_scoops - a.total_scoops)
          .slice(0, 10); // Top 10 pools

        const options: PoolOption[] = sorted.map((stat: any) => ({
          hash: stat.pub_key_hash,
          name: getScooperName(stat.pub_key_hash),
          scoops: stat.total_scoops
        }));

        setPoolOptions(options);
      })
      .catch((error) => console.error('Error fetching pool options:', error));
  }, []);

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
      MuiTabs: {
        styleOverrides: {
          root: {
            borderBottom: '1px solid rgba(240, 112, 208, 0.2)',
            backgroundColor: '#1A1329',
            borderRadius: '16px',
          },
          indicator: {
            height: 3,
            background: 'linear-gradient(135deg, #F070D0 0%, #A855F7 100%)',
            borderRadius: '3px 3px 0 0',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            color: '#D1C4E9',
            transition: 'all 0.3s ease',
            '&:hover': {
              color: '#F070D0',
            },
            '&.Mui-selected': {
              color: '#FFFFFF',
              background: 'linear-gradient(135deg, rgba(240, 112, 208, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(240, 112, 208, 0.5)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#F070D0',
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: '#D1C4E9',
            '&.Mui-focused': {
              color: '#F070D0',
            },
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: 'rgba(240, 112, 208, 0.1)',
            },
            '&.Mui-selected': {
              backgroundColor: 'rgba(240, 112, 208, 0.2)',
              '&:hover': {
                backgroundColor: 'rgba(240, 112, 208, 0.3)',
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
            <Box sx={{ textAlign: 'center', mb: 4, mt: 4 }}>
              <Typography variant="h4" component="h1" sx={{ mb: 2, fontSize: '2.5rem' }}>
                Scooper Analytics Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                Track DEX scooper performance - one scoop at a time 🍦
              </Typography>
            </Box>

            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                sx={{
                  mb: 2,
                  width: 'fit-content',
                  '& .MuiTabs-flexContainer': {
                    gap: 2,
                  }
                }}
              >
                <Tab
                  label="Live Scoops"
                  id="scooper-tab-0"
                  aria-controls="scooper-tabpanel-0"
                />
                <Tab
                  label="Analytics"
                  id="scooper-tab-1"
                  aria-controls="scooper-tabpanel-1"
                />
                <Tab
                  label="Reports"
                  id="scooper-tab-2"
                  aria-controls="scooper-tabpanel-2"
                />
                <Tab
                  label="Balances"
                  id="scooper-tab-3"
                  aria-controls="scooper-tabpanel-3"
                />
              </Tabs>

              <TabPanel value={activeTab} index={0}>
                <Scoops />
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                {/* Filters */}
                <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel id="pool-select-label">Scooper Pool</InputLabel>
                    <Select
                      labelId="pool-select-label"
                      id="pool-select"
                      value={selectedPool}
                      label="Scooper Pool"
                      onChange={(e) => setSelectedPool(e.target.value)}
                    >
                      <MenuItem value="all">All Pools</MenuItem>
                      {poolOptions.map((pool) => (
                        <MenuItem key={pool.hash} value={pool.hash}>
                          {pool.name} ({pool.scoops} scoops)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl sx={{ minWidth: 150 }}>
                    <InputLabel id="time-period-label">Time Period</InputLabel>
                    <Select
                      labelId="time-period-label"
                      id="time-period-select"
                      value={timePeriod}
                      label="Time Period"
                      onChange={(e) => setTimePeriod(e.target.value as number)}
                    >
                      <MenuItem value={7}>Last 7 days</MenuItem>
                      <MenuItem value={14}>Last 14 days</MenuItem>
                      <MenuItem value={30}>Last 30 days</MenuItem>
                      <MenuItem value={90}>Last 90 days</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Scoops Stats Section */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                    Scoops Stats
                  </Typography>
                  <Grid2 container direction="row" spacing={3} justifyContent={"center"} alignItems={"flex-start"}>
                    <Grid2>
                      <ScoopsPies selectedPool={selectedPool} timePeriod={timePeriod} />
                    </Grid2>
                    <Grid2>
                      <BasicBars selectedPool={selectedPool} timePeriod={timePeriod} />
                    </Grid2>
                  </Grid2>
                </Box>

                <Divider sx={{ my: 4 }} />

                {/* Protocol Analytics Section */}
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                    Protocol Analytics
                  </Typography>
                  <ProtocolAnalytics />
                </Box>
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <ScoopsCsvDownload />
              </TabPanel>

              <TabPanel value={activeTab} index={3}>
                <ScooperBalances />
              </TabPanel>
            </Box>
          </Container>
        </ThemeProvider>
      </div>
    </div>
  );
}
