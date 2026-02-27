import React, { useState, useEffect } from "react";
import Head from "next/head";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useWallet } from "@meshsdk/react";
import toast from "react-hot-toast";
import { Box, Container, Typography, Button, Card, CardContent, Stepper, Step, StepLabel, Divider, CircularProgress, IconButton, Tooltip, Checkbox, FormControlLabel } from "@mui/material";
import { ContentCopy, Warning } from "@mui/icons-material";
import { MeshTxBuilder, mConStr0 } from "@meshsdk/core";
import { BlockfrostProvider } from "@meshsdk/core";

const CardanoSummit2025Page = () => {
  const { wallet, connected } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0); // 0: Challenge, 1: Waiting, 2: Collect
  const [challengeTxHash, setChallengeTxHash] = useState("");
  const [countdown, setCountdown] = useState(120); // 2 minutes countdown
  const [discountCode, setDiscountCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
      <Head>
        {/* Basic Meta Tags */}
        <title>Cardano Summit 2025 Developer Discount Challenge | Easy1Staking</title>
        <meta name="description" content="Claim your exclusive Cardano Summit 2025 developer discount! Complete the blockchain challenge, verify your developer status, and save up to 47% on summit tickets. For legitimate Cardano developers only." />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://easy1staking.com/cardano-summit-2025" />
        <meta property="og:title" content="🎉 Cardano Summit 2025 Developer Discount Challenge" />
        <meta property="og:description" content="Exclusive developer discount for Cardano Summit 2025! Complete the blockchain challenge and save up to 47% on your summit ticket. Three-step verification process for legitimate developers only." />
        <meta property="og:image" content="https://easy1staking.com/images/summit-2025-preview.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Easy1Staking" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://easy1staking.com/cardano-summit-2025" />
        <meta property="twitter:title" content="🎉 Cardano Summit 2025 Developer Discount Challenge" />
        <meta property="twitter:description" content="Exclusive developer discount for Cardano Summit 2025! Complete the blockchain challenge and save up to 47% on your summit ticket." />
        <meta property="twitter:image" content="https://easy1staking.com/images/summit-2025-preview.jpg" />
        
        {/* Additional SEO */}
        <meta name="keywords" content="Cardano Summit 2025, Developer Discount, Blockchain Challenge, Cardano Developers, Summit Tickets, Easy1Staking" />
        <meta name="author" content="Easy1Staking" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://easy1staking.com/cardano-summit-2025" />
        
        {/* Schema.org for Search Engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": "Cardano Summit 2025 Developer Discount Challenge",
              "description": "Exclusive developer discount challenge for Cardano Summit 2025 tickets",
              "url": "https://easy1staking.com/cardano-summit-2025",
              "provider": {
                "@type": "Organization",
                "name": "Easy1Staking",
                "url": "https://easy1staking.com"
              },
              "offers": {
                "@type": "Offer",
                "description": "Up to 47% discount on Cardano Summit 2025 tickets for verified developers",
                "eligibility": "Cardano developers only"
              }
            })
          }}
        />
      </Head>
      
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
          ) : !acceptedTerms ? (
            // Terms & Conditions Disclaimer
            <Card sx={{ 
              maxWidth: 800, 
              mx: "auto", 
              p: 3,
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
            }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <Warning sx={{ color: "#FF9800", fontSize: 32 }} />
                  <Typography variant="h4" sx={{ fontWeight: "bold", color: "#FF9800" }}>
                    Terms & Conditions
                  </Typography>
                </Box>
                
                <Typography variant="body1" sx={{ mb: 3, fontWeight: "bold" }}>
                  Please read and accept the following terms before proceeding:
                </Typography>

                <Box sx={{ mb: 4, pl: 2 }}>
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                    <strong>1. No Financial Responsibility:</strong> We assume no responsibility for any lost funds, transaction fees, or financial losses incurred while using this service.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                    <strong>2. Service Reliability:</strong> We take no responsibility if the service errors, fails to work, or if discount codes are not generated successfully.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                    <strong>3. No Support Provided:</strong> This is a free service provided without any technical support or customer service.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                    <strong>4. Wallet Recommendations:</strong> It&apos;s recommended to use a small hot wallet with minimal funds (about 10 $ada). Hardware wallet support is not guaranteed.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                    <strong>5. Developer Eligibility:</strong> This discount is intended for legitimate Cardano developers only. Using this service without being a developer constitutes cheating and violates the spirit of the developer program.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                    <strong>6. Beta Service:</strong> This tool is provided as-is and may contain bugs or unexpected behavior. Use at your own risk.
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
                    <strong>7. Data Privacy:</strong> Transaction data and wallet addresses may be temporarily locally stored for functionality purposes only.
                  </Typography>
                </Box>

                <Box sx={{ mb: 4, p: 2, bgcolor: "#fff3e0", borderRadius: 2, border: "1px solid #FF9800" }}>
                  <Typography variant="body2" sx={{ fontWeight: "bold", color: "#E65100" }}>
                    ⚠️ IMPORTANT: By proceeding, you acknowledge that you are a legitimate Cardano developer and agree to all terms above.
                  </Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      sx={{ color: "#FF9800" }}
                    />
                  }
                  label={
                    <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                      I have read and accept all terms and conditions above
                    </Typography>
                  }
                  sx={{ mb: 3 }}
                />

                <Button
                  variant="contained"
                  size="large"
                  disabled={!acceptedTerms}
                  onClick={() => setAcceptedTerms(true)}
                  sx={{
                    bgcolor: acceptedTerms ? "#2E7D32" : "#ccc",
                    "&:hover": { 
                      bgcolor: acceptedTerms ? "#1B5E20" : "#ccc"
                    },
                    py: 1.5,
                    px: 4,
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                    width: "100%"
                  }}
                >
                  {acceptedTerms ? "Proceed to Developer Challenge" : "Please Accept Terms to Continue"}
                </Button>
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
            <Typography variant="h5" sx={{ color: "white", fontWeight: "bold", mb: 4 }}>
              💡 Support & Backup Options
            </Typography>
            
            <Box sx={{ 
              mb: 4, 
              p: 4, 
              bgcolor: "rgba(46, 125, 50, 0.15)", 
              borderRadius: 3,
              border: "2px solid rgba(46, 125, 50, 0.3)",
              boxShadow: "0 4px 20px rgba(46, 125, 50, 0.2)"
            }}>
              <Typography variant="h6" sx={{ color: "white", mb: 3, fontWeight: "bold" }}>
                🙏 Enjoying this service? Support the developer!
              </Typography>
              <Box sx={{ 
                display: "flex", 
                flexDirection: { xs: "column", sm: "row" }, 
                gap: 2, 
                justifyContent: "center",
                alignItems: "center"
              }}>
                <Box sx={{ p: 2, bgcolor: "rgba(255, 255, 255, 0.1)", borderRadius: 2 }}>
                  <Typography variant="body1" sx={{ color: "#4FC3F7", fontWeight: "bold" }}>
                    💰 Tip: <span style={{ fontFamily: "monospace", color: "white" }}>$cryptojoe101</span>
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "white", fontWeight: "bold" }}>
                  OR
                </Typography>
                <Box sx={{ p: 2, bgcolor: "rgba(255, 255, 255, 0.1)", borderRadius: 2 }}>
                  <Typography variant="body1" sx={{ color: "#4CAF50", fontWeight: "bold" }}>
                    🏊 Delegate to Easy1StakePool
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ 
              p: 4, 
              bgcolor: "rgba(255, 152, 0, 0.15)", 
              borderRadius: 3,
              border: "2px solid rgba(255, 152, 0, 0.3)",
              boxShadow: "0 4px 20px rgba(255, 152, 0, 0.2)"
            }}>
              <Typography variant="h6" sx={{ color: "white", mb: 2, fontWeight: "bold" }}>
                🛠️ Having Issues?
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255, 255, 255, 0.9)", lineHeight: 1.6 }}>
                If you completed the challenge but can&apos;t collect your discount code here, 
                you can complete the &quot;ownership verification&quot; directly on the{" "}
                <a 
                  href="https://hey.cardano.org/summitdeals" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: "#FFD700", 
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