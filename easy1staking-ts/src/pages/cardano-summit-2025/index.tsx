import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWallet } from "@meshsdk/react";
import toast from "react-hot-toast";
import { Box, Container, Typography, Button, Card, CardContent, Stepper, Step, StepLabel, Divider, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { ContentCopy } from "@mui/icons-material";
import { MeshTxBuilder, mConStr0 } from "@meshsdk/core";
import { BlockfrostProvider } from "@meshsdk/core";

const CardanoSummit2025Page = () => {
  const { wallet, connected } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0); // 0: Challenge, 1: Waiting, 2: Collect
  const [challengeTxHash, setChallengeTxHash] = useState("");
  const [countdown, setCountdown] = useState(120); // 2 minutes countdown
  const [discountCode, setDiscountCode] = useState("");

  const phases = ["Complete Challenge", "Verify Transaction", "Collect Discount"];

  useEffect(() => {
    const checkDiscountStatus = async () => {
      if (connected && wallet) {
        try {
          const addresses = await wallet.getUsedAddresses();
          if (addresses && addresses.length > 0) {
            const userAddress = addresses[0];
            const phaseData = localStorage.getItem(`summit_phase_${userAddress}`);
            if (phaseData) {
              const parsed = JSON.parse(phaseData);
              setCurrentPhase(parsed.phase || 0);
              setChallengeTxHash(parsed.txHash || "");
              setDiscountCode(parsed.discountCode || "");
            }
          }
        } catch (error) {
          console.error("Error checking phase status:", error);
        }
      }
    };

    checkDiscountStatus();
  }, [connected, wallet]);

  // Countdown effect for phase 1
  useEffect(() => {
    if (currentPhase === 1 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (currentPhase === 1 && countdown === 0) {
      // Auto-advance to phase 2 after countdown
      setCurrentPhase(2);
      savePhaseToStorage(2, challengeTxHash, "");
    }
  }, [currentPhase, countdown, challengeTxHash]);

  const savePhaseToStorage = async (phase: number, txHash: string, code: string) => {
    if (connected && wallet) {
      const addresses = await wallet.getUsedAddresses();
      if (addresses && addresses.length > 0) {
        const userAddress = addresses[0];
        localStorage.setItem(`summit_phase_${userAddress}`, JSON.stringify({
          phase,
          txHash,
          discountCode: code,
          timestamp: new Date().toISOString()
        }));
      }
    }
  };

  const handleSubmitChallenge = async () => {
    if (!connected) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsProcessing(true);
    
    try {
      const addresses = await wallet.getUsedAddresses();
      if (!addresses || addresses.length === 0) {
        toast.error("Unable to get wallet address");
        return;
      }

      const walletAddress = addresses[0];
      const utxos = await wallet.getUtxos();
      
      toast.loading("Building challenge transaction...");

      // Create the challenge datum as specified
      const challengeDatum = mConStr0(["cardano-summit-2025", 1]);
      
      // Get Blockfrost API key from environment
      const blockfrostApiKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
      if (!blockfrostApiKey) {
        throw new Error("Blockfrost API key not configured");
      }
      
      const blockfrostProvider = new BlockfrostProvider(blockfrostApiKey);
      const txBuilder = new MeshTxBuilder({
        fetcher: blockfrostProvider,
        submitter: blockfrostProvider,
      });
      
      await txBuilder
        .txOut(walletAddress, [{ unit: "lovelace", quantity: "2000000" }]) // 2 ADA
        .txOutInlineDatumValue(challengeDatum)
        .changeAddress(walletAddress)
        .selectUtxosFrom(utxos)
        .complete();

      toast.dismiss();
      toast.loading("Please sign the transaction in your wallet...");

      const signedTx = await wallet.signTx(txBuilder.txHex);
      const txHash = await wallet.submitTx(signedTx);
      
      toast.dismiss();
      toast.success("Challenge transaction submitted successfully!");
      
      setChallengeTxHash(txHash);
      setCurrentPhase(1);
      setCountdown(120); // Reset countdown
      savePhaseToStorage(1, txHash, "");
      
    } catch (error) {
      toast.dismiss();
      console.error("Error submitting challenge:", error);
      toast.error("Failed to submit challenge transaction. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyTransaction = async () => {
    // Check if transaction is confirmed on-chain
    setIsProcessing(true);
    
    try {
      if (!challengeTxHash) {
        toast.error("No transaction hash found");
        return;
      }

      toast.loading("Checking transaction on blockchain...");
      
      // Check if transaction exists on-chain using our proxy API
      const response = await fetch(`/api/verify-tx?txHash=${challengeTxHash}`);
      
      const result = await response.json();
      
      if (response.ok && result.confirmed) {
        // Transaction exists and is confirmed
        toast.dismiss();
        toast.success("Transaction confirmed on-chain!");
        setCurrentPhase(2);
        savePhaseToStorage(2, challengeTxHash, "");
        
      } else if (response.status === 404 || !result.confirmed) {
        toast.dismiss();
        toast.error("Transaction not yet confirmed. Please wait a bit longer.");
      } else {
        toast.dismiss();
        toast.error("Error checking transaction status. Please try again.");
      }
      
    } catch (error) {
      toast.dismiss();
      console.error("Error verifying transaction:", error);
      toast.error("Failed to verify transaction. Please wait for confirmation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignData = async () => {
    if (!connected) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Get stake address for the verification
      const rewardAddresses = await wallet.getRewardAddresses();
      if (!rewardAddresses || rewardAddresses.length === 0) {
        toast.error("Unable to get stake address from wallet");
        return;
      }
      
      const stakeAddress = rewardAddresses[0];
      const timestamp = Date.now();
      
      // Create the exact challenge message format expected by the API
      const challengeMessage = `Discount Qualifier - Sign this message to prove you control this wallet address. Wallet: ${stakeAddress} - timestamp: ${timestamp}`;
      
      toast.loading("Please sign the message in your wallet...");
      
      // Sign the data using CIP-30 signData method with stake address
      // Convert message to hex as required by CIP-30
      const messageHex = Buffer.from(challengeMessage, 'utf8').toString('hex');
      const signResult = await wallet.signData(messageHex, stakeAddress);
      
      toast.dismiss();
      toast.loading("Verifying with Summit Deals API...");
      
      // Prepare the API request payload
      const payload = {
        stakeAddress: stakeAddress,
        signature: signResult.signature,
        publicKey: signResult.key,
        challengeMessage: challengeMessage,
        drepId: "drep1yfrc2h5nn6zzmnwc7rnrf45kgxxy6znr08t5kfucav2guncp89k2z"
      };
      
      // Call the Summit Deals API via our proxy to avoid CORS issues
      const response = await fetch('/api/summit-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      toast.dismiss();
      
      if (response.ok && result.success && result.data?.success) {
        // Extract discount code from the nested API response structure
        const developerResult = result.data.results?.find((r: any) => r.category === "developers");
        
        if (developerResult?.eligible && developerResult?.discountCode) {
          const discountCode = developerResult.discountCode;
          const discountPercentage = developerResult.discountPercentage;
          const discountAmount = developerResult.discountAmount;
          
          toast.success(`Developer discount verified! ${discountPercentage}% off ($${discountAmount} savings)`);
          setDiscountCode(discountCode);
          savePhaseToStorage(2, challengeTxHash, discountCode);
        } else {
          // Check if challenge was completed but not eligible for developer discount
          if (developerResult?.details?.challengeCompleted) {
            toast.error("Challenge completed but not eligible for developer discount");
          } else {
            toast.error("Developer challenge not found or incomplete");
          }
          console.log("Developer result:", developerResult);
        }
        
      } else {
        // Handle API error
        const errorMsg = result.message || result.error || "Verification failed";
        toast.error(`Verification failed: ${errorMsg}`);
        console.error("API Error:", result);
      }
      
    } catch (error) {
      toast.dismiss();
      console.error("Error in verification process:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("User declined")) {
        toast.error("Signature cancelled by user");
      } else if (errorMessage.includes("fetch")) {
        toast.error("Network error - please check your connection");
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartOver = async () => {
    if (!connected || !wallet) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      const addresses = await wallet.getUsedAddresses();
      if (addresses && addresses.length > 0) {
        const userAddress = addresses[0];
        localStorage.removeItem(`summit_phase_${userAddress}`);
        
        // Reset all state
        setCurrentPhase(0);
        setChallengeTxHash("");
        setDiscountCode("");
        setCountdown(120);
        
        toast.success("Progress reset! You can start the challenge again.");
      }
    } catch (error) {
      console.error("Error resetting progress:", error);
      toast.error("Failed to reset progress");
    }
  };

  const handleCopyCode = () => {
    if (discountCode) {
      navigator.clipboard.writeText(discountCode).then(() => {
        toast.success("Discount code copied to clipboard!");
      }).catch(() => {
        toast.error("Failed to copy code");
      });
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <Navbar />
        
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Typography 
              variant="h2" 
              component="h1" 
              sx={{ 
                color: "white", 
                fontWeight: "bold", 
                mb: 2,
                fontSize: { xs: "2rem", md: "3rem" }
              }}
            >
              🎉 Cardano Summit 2025
            </Typography>
            <Typography 
              variant="h4" 
              component="h2" 
              sx={{ 
                color: "white", 
                mb: 4,
                fontSize: { xs: "1.5rem", md: "2rem" }
              }}
            >
              Collect Your Discount
            </Typography>
          </Box>

          {/* Progress Stepper */}
          <Box sx={{ mb: 6 }}>
            <Stepper activeStep={currentPhase} alternativeLabel sx={{ mb: 4 }}>
              {phases.map((label, index) => (
                <Step key={label}>
                  <StepLabel 
                    sx={{ 
                      '& .MuiStepLabel-label': { 
                        color: 'white',
                        fontWeight: index === currentPhase ? 'bold' : 'normal'
                      },
                      '& .MuiStepIcon-root': {
                        color: index <= currentPhase ? '#2E7D32' : 'rgba(255,255,255,0.5)'
                      }
                    }}
                  >
                    {label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>
            
            {/* Start Over Button - only show if connected and has progress */}
            {connected && (currentPhase > 0 || challengeTxHash || discountCode) && (
              <Box sx={{ textAlign: "center" }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleStartOver}
                  sx={{
                    borderColor: "rgba(255, 255, 255, 0.5)",
                    color: "rgba(255, 255, 255, 0.7)",
                    "&:hover": {
                      borderColor: "rgba(255, 255, 255, 0.8)",
                      backgroundColor: "rgba(255, 255, 255, 0.1)"
                    }
                  }}
                >
                  🔄 Start Over
                </Button>
              </Box>
            )}
          </Box>

          {!connected ? (
            <Card sx={{ 
              maxWidth: 600, 
              mx: "auto", 
              p: 3,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
            }}>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                  Connect Your Wallet
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, color: "#666" }}>
                  Please connect your Cardano wallet to begin the developer challenge.
                </Typography>
                <Typography variant="caption" sx={{ color: "#999" }}>
                  Use the &quot;Connect Wallet&quot; button in the navigation above
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
              
              {/* Phase 1: Complete Challenge */}
              <Card sx={{ 
                background: currentPhase === 0 ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(10px)",
                borderRadius: 3,
                boxShadow: currentPhase === 0 ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.2)"
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                    Phase 1: Complete the Challenge
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
                    Create a UTXO with the special datum by sending 2 ADA to your own wallet. 
                    This transaction will include an inline datum with the challenge identifier.
                  </Typography>
                  <Box sx={{ mb: 3, p: 2, bgcolor: "#f5f5f5", borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Technical Details:</strong><br/>
                      • Datum: constructor 0, fields: [&quot;cardano-summit-2025&quot;, 1]<br/>
                      • Amount: 2 ADA to your own address<br/>
                      • Type: Inline datum transaction
                    </Typography>
                  </Box>
                  {currentPhase === 0 ? (
                    <Button
                      variant="contained"
                      size="large"
                      onClick={handleSubmitChallenge}
                      disabled={isProcessing}
                      sx={{
                        bgcolor: "#2E7D32",
                        "&:hover": { bgcolor: "#1B5E20" },
                        py: 1.5,
                        px: 4,
                        fontSize: "1.1rem",
                        fontWeight: "bold"
                      }}
                    >
                      {isProcessing ? "Processing..." : "Submit Challenge"}
                    </Button>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2" sx={{ color: "#2E7D32", fontWeight: "bold" }}>
                        ✅ Challenge Completed
                      </Typography>
                      {challengeTxHash && (
                        <Typography variant="caption" sx={{ color: "#666" }}>
                          Tx: {challengeTxHash.slice(0, 8)}...{challengeTxHash.slice(-8)}
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>

              <Divider sx={{ bgcolor: "rgba(255,255,255,0.3)", height: 2 }} />

              {/* Phase 2: Wait for Transaction */}
              <Card sx={{ 
                background: currentPhase === 1 ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(10px)",
                borderRadius: 3,
                boxShadow: currentPhase === 1 ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.2)"
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                    Phase 2: Transaction Verification
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
                    Waiting for your challenge transaction to be confirmed on the Cardano blockchain.
                    This typically takes 1-3 minutes.
                  </Typography>
                  {currentPhase === 1 ? (
                    <Box sx={{ textAlign: "center" }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mb: 3 }}>
                        <CircularProgress size={24} />
                        <Typography variant="h6">
                          {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 3, color: "#666" }}>
                        Transaction Hash: {challengeTxHash.slice(0, 12)}...{challengeTxHash.slice(-12)}
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={handleVerifyTransaction}
                        disabled={isProcessing}
                        sx={{ borderColor: "#2E7D32", color: "#2E7D32" }}
                      >
                        {isProcessing ? "Checking..." : "Check Now"}
                      </Button>
                    </Box>
                  ) : currentPhase > 1 ? (
                    <Typography variant="body2" sx={{ color: "#2E7D32", fontWeight: "bold" }}>
                      ✅ Transaction Verified on Blockchain
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{ color: "#999" }}>
                      Waiting for Phase 1 completion...
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Divider sx={{ bgcolor: "rgba(255,255,255,0.3)", height: 2 }} />

              {/* Phase 3: Collect Discount */}
              <Card sx={{ 
                background: currentPhase === 2 ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(10px)",
                borderRadius: 3,
                boxShadow: currentPhase === 2 ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 4px 16px rgba(0, 0, 0, 0.2)"
              }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
                    Phase 3: Collect Your Discount
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
                    Sign a message to prove ownership of your wallet and generate your unique discount code 
                    for Cardano Summit 2025.
                  </Typography>
                  {currentPhase === 2 ? (
                    discountCode ? (
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h6" sx={{ color: "#2E7D32", fontWeight: "bold", mb: 2 }}>
                          🎉 Your Discount Code
                        </Typography>
                        <Box sx={{ 
                          p: 2, 
                          bgcolor: "#e8f5e8", 
                          borderRadius: 2, 
                          border: "2px solid #2E7D32",
                          mb: 3,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 2
                        }}>
                          <Typography variant="h4" sx={{ fontFamily: "monospace", fontWeight: "bold" }}>
                            {discountCode}
                          </Typography>
                          <Tooltip title="Copy to clipboard">
                            <IconButton 
                              onClick={handleCopyCode}
                              sx={{ 
                                color: "#2E7D32",
                                "&:hover": { 
                                  backgroundColor: "rgba(46, 125, 50, 0.1)" 
                                }
                              }}
                            >
                              <ContentCopy />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Button
                          variant="outlined"
                          href="https://summit.cardano.org"
                          target="_blank"
                          sx={{ borderColor: "#2E7D32", color: "#2E7D32" }}
                        >
                          Use Code at Summit Registration
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        variant="contained"
                        size="large"
                        onClick={handleSignData}
                        disabled={isProcessing}
                        sx={{
                          bgcolor: "#2E7D32",
                          "&:hover": { bgcolor: "#1B5E20" },
                          py: 1.5,
                          px: 4,
                          fontSize: "1.1rem",
                          fontWeight: "bold"
                        }}
                      >
                        {isProcessing ? "Processing..." : "Sign & Get Discount Code"}
                      </Button>
                    )
                  ) : (
                    <Typography variant="body2" sx={{ color: "#999" }}>
                      Complete previous phases to unlock...
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}

          <Box sx={{ textAlign: "center", mt: 6, p: 4 }}>
            <Typography variant="h6" sx={{ color: "white", fontWeight: "bold", mb: 3 }}>
              💡 Support & Backup Options
            </Typography>
            
            <Box sx={{ mb: 4, p: 3, bgcolor: "rgba(255, 255, 255, 0.1)", borderRadius: 2 }}>
              <Typography variant="body1" sx={{ color: "white", mb: 2, fontWeight: "bold" }}>
                Enjoying this service? Support the developer! 🙏
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.9)", mb: 2 }}>
                • <strong>Tip via ADA Handle:</strong> $cryptojoe101
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                • <strong>Delegate to Easy1StakePool:</strong> Use our staking assessment tool on this website
              </Typography>
            </Box>

            <Box sx={{ p: 3, bgcolor: "rgba(255, 255, 255, 0.1)", borderRadius: 2 }}>
              <Typography variant="body1" sx={{ color: "white", mb: 2, fontWeight: "bold" }}>
                Having Issues? 🛠️
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.9)", lineHeight: 1.6 }}>
                If you successfully completed the challenge but can&apos;t collect your discount code here, 
                no worries! You can complete the &quot;ownership verification&quot; directly on the{" "}
                <a 
                  href="https://hey.cardano.org/summitdeals" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: "#4FC3F7", 
                    textDecoration: "underline",
                    fontWeight: "bold"
                  }}
                >
                  Summit Deals website
                </a>
                {" "}using your challenge transaction.
              </Typography>
            </Box>
          </Box>
        </Container>
      </div>
      
      <Footer />
    </>
  );
};

export default CardanoSummit2025Page;