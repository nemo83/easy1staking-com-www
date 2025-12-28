import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@meshsdk/react';
import Head from 'next/head';
import toast from 'react-hot-toast';
import {
  Container, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, TablePagination,
  Box, Typography, CircularProgress, Alert, TextField,
  IconButton, Tooltip, Button, Card, CardContent
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import Navbar from '@/components/Navbar';
import { KreateNFT } from '@/lib/interfaces/AppTypes';
import { EASY1STAKING_API, KREATE_SCRIPT } from '@/lib/util/Constants';
import { MeshTxBuilder, mConStr, BlockfrostProvider } from '@meshsdk/core';

const BLOCKFROST_API_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
const blockfrostProvider = new BlockfrostProvider(BLOCKFROST_API_KEY!);

export default function KreateDelistPage() {
  // Wallet state
  const { wallet, connected } = useWallet();
  const [walletAddress, setWalletAddress] = useState<string>("");

  // NFT data state
  const [nfts, setNfts] = useState<KreateNFT[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Table state
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<'assetName' | 'policyId'>('assetName');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Transaction state
  const [delistingInProgress, setDelistingInProgress] = useState<Set<string>>(new Set());
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Utility function for hex decoding
  const hexDecode = (hexString: string): string => {
    try {
      return Buffer.from(hexString, 'hex').toString('utf8');
    } catch (e) {
      console.error('Failed to decode hex:', e);
      return hexString;
    }
  };

  // Wallet connection logic
  useEffect(() => {
    if (connected) {
      wallet.getUsedAddresses()
        .then((addresses) => {
          if (addresses && addresses.length > 0) {
            setWalletAddress(addresses[0]);
          }
        })
        .catch((err) => {
          console.error('Error getting wallet address:', err);
          toast.error('Failed to get wallet address');
        });
    } else {
      setWalletAddress("");
      setNfts([]);
    }
  }, [connected, wallet]);

  // Fetch NFTs from API
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!walletAddress) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${EASY1STAKING_API}/kreate/utxo/${encodeURIComponent(walletAddress)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch NFTs: ${response.status}`);
        }

        const data = await response.json();

        // Check if data is an array
        if (!Array.isArray(data)) {
          console.error('API response is not an array:', data);
          throw new Error('Invalid API response format');
        }

        const transformedNFTs: KreateNFT[] = data.map((item: any) => ({
          assetName: item.asset_name,
          assetNameDecoded: hexDecode(item.asset_name),
          policyId: item.policy_id,
          txHash: item.tx_hash,
          outputIndex: item.output_index,
          scriptBytes: item.script_bytes || '',
          utxoId: `${item.tx_hash}#${item.output_index}`
        }));

        setNfts(transformedNFTs);
      } catch (err) {
        console.error('Error fetching Kreate NFTs:', err);
        setError('Failed to load Kreate NFTs');
        toast.error('Failed to load Kreate NFTs', { duration: 3000 });
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [walletAddress]);

  // Filter by search query
  const filteredNFTs = useMemo(() => {
    if (!searchQuery) return nfts;

    const query = searchQuery.toLowerCase();
    return nfts.filter((nft) =>
      nft.assetName.toLowerCase().includes(query) ||
      nft.assetNameDecoded.toLowerCase().includes(query) ||
      nft.policyId.toLowerCase().includes(query)
    );
  }, [nfts, searchQuery]);

  // Sort filtered results
  const sortedNFTs = useMemo(() => {
    return [...filteredNFTs].sort((a, b) => {
      let comparison = 0;
      if (orderBy === 'assetName') {
        comparison = a.assetNameDecoded.localeCompare(b.assetNameDecoded);
      } else if (orderBy === 'policyId') {
        comparison = a.policyId.localeCompare(b.policyId);
      }
      return order === 'asc' ? comparison : -comparison;
    });
  }, [filteredNFTs, order, orderBy]);

  // Paginate sorted results
  const paginatedNFTs = useMemo(() => {
    return sortedNFTs.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [sortedNFTs, page, rowsPerPage]);

  // Helper functions
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedText(null), 2000);
    });
  };

  const handleRequestSort = (property: 'assetName' | 'policyId') => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const truncate = (str: string, length: number = 16) => {
    if (str.length <= length) return str;
    return `${str.slice(0, length / 2)}...${str.slice(-length / 2)}`;
  };

  // Delist NFT transaction
  const delistNFT = async (nft: KreateNFT) => {
    if (!connected || !wallet) {
      toast.error("Please connect your wallet");
      return;
    }

    setDelistingInProgress(prev => new Set(prev).add(nft.utxoId));

    try {
      toast.loading(`Delisting ${nft.assetNameDecoded}...`, { id: 'delist' });

      // Get collateral
      let collateralUtxos = await wallet.getCollateral();
      const walletUtxos = await wallet.getUtxos();

      if (collateralUtxos.length === 0) {
        collateralUtxos = walletUtxos.filter((utxo) => utxo.output.amount.length === 1);
      }

      if (collateralUtxos.length === 0) {
        throw new Error('Wallet has no available collateral. Please set it in your wallet or send additional 5 ADA to your wallet address.');
      }

      // Fetch the UTXO details from the blockchain
      const utxo = await blockfrostProvider.fetchUTxOs(nft.txHash);
      if (!utxo || utxo.length === 0) {
        throw new Error('UTXO not found on chain');
      }

      const scriptUtxo = utxo[nft.outputIndex];
      if (!scriptUtxo) {
        throw new Error(`UTXO at index ${nft.outputIndex} not found`);
      }

      // Build the transaction
      const txBuilder = new MeshTxBuilder({
        fetcher: blockfrostProvider,
        submitter: blockfrostProvider,
      });

      txBuilder
        .spendingPlutusScriptV2()
        .txIn(nft.txHash, nft.outputIndex)
        .txInInlineDatumPresent()
        .txInRedeemerValue(mConStr(1, []))
        .txInScript(KREATE_SCRIPT.code)
        .txOut(walletAddress, scriptUtxo.output.amount)
        .changeAddress(walletAddress)
        .txInCollateral(collateralUtxos[0].input.txHash, collateralUtxos[0].input.outputIndex)
        .selectUtxosFrom(walletUtxos);

      await txBuilder.complete();

      const unsignedTx = txBuilder.txHex;
      const signedTx = await wallet.signTx(unsignedTx);
      const txHash = await wallet.submitTx(signedTx);

      toast.dismiss('delist');
      toast.success(`Successfully delisted! TX: ${txHash}`);

      // Remove from list on success
      setNfts(prev => prev.filter(n => n.utxoId !== nft.utxoId));

    } catch (err) {
      toast.dismiss('delist');
      console.error('Error delisting NFT:', err);
      toast.error(`Failed to delist: ${err}`);
    } finally {
      setDelistingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(nft.utxoId);
        return newSet;
      });
    }
  };

  return (
    <>
      <Head>
        <title>Kreate NFT Delisting | Easy1Staking</title>
        <meta name="description" content="Delist your NFTs from Kreate marketplace" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <Navbar />

        <Container maxWidth="xl" sx={{ py: 8 }}>
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Typography variant="h2" sx={{ color: "white", fontWeight: "bold", mb: 2 }}>
              Kreate NFT Delisting
            </Typography>
            <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.8)" }}>
              Delist your NFTs from Kreate marketplace before it closes
            </Typography>
          </Box>

          {/* Not Connected State */}
          {!connected && (
            <Card sx={{ maxWidth: 600, mx: "auto", p: 3 }}>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  Connect Your Wallet
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Please connect your Cardano wallet to view and delist your Kreate NFTs.
                </Typography>
              </CardContent>
            </Card>
          )}

          {/* Connected State */}
          {connected && (
            <Box>
              {/* Search Bar */}
              <Box sx={{ mb: 3, maxWidth: 600, mx: "auto" }}>
                <TextField
                  fullWidth
                  placeholder="Search by asset name or policy ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                  }}
                  sx={{ backgroundColor: 'white', borderRadius: 1 }}
                />
              </Box>

              {/* Loading State */}
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress />
                </Box>
              )}

              {/* Error State */}
              {error && (
                <Alert severity="error" sx={{ maxWidth: 600, mx: "auto" }}>
                  {error}
                </Alert>
              )}

              {/* No NFTs State */}
              {!loading && !error && nfts.length === 0 && (
                <Card sx={{ maxWidth: 600, mx: "auto", p: 3 }}>
                  <CardContent sx={{ textAlign: "center" }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      No Kreate NFTs Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      This wallet doesn&apos;t have any NFTs listed on Kreate.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* NFT Table */}
              {!loading && !error && nfts.length > 0 && (
                <Paper>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            <TableSortLabel
                              active={orderBy === 'assetName'}
                              direction={orderBy === 'assetName' ? order : 'asc'}
                              onClick={() => handleRequestSort('assetName')}
                            >
                              Asset Name
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={orderBy === 'policyId'}
                              direction={orderBy === 'policyId' ? order : 'asc'}
                              onClick={() => handleRequestSort('policyId')}
                            >
                              Policy ID
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>UTXO</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedNFTs.map((nft) => (
                          <TableRow key={nft.utxoId}>
                            {/* Asset Name Cell */}
                            <TableCell>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                  {nft.assetNameDecoded}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Hex: {truncate(nft.assetName, 20)}
                                  </Typography>
                                  <Tooltip title={copiedText === nft.assetName ? "Copied!" : "Copy hex"}>
                                    <IconButton size="small" onClick={() => handleCopy(nft.assetName)}>
                                      <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                            </TableCell>

                            {/* Policy ID Cell */}
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2">
                                  {truncate(nft.policyId, 16)}
                                </Typography>
                                <Tooltip title={copiedText === nft.policyId ? "Copied!" : "Copy policy ID"}>
                                  <IconButton size="small" onClick={() => handleCopy(nft.policyId)}>
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="View on explorer">
                                  <IconButton
                                    size="small"
                                    component="a"
                                    href={`https://cardanoscan.io/token/${nft.policyId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>

                            {/* UTXO Cell */}
                            <TableCell>
                              <Tooltip title={`${nft.txHash}#${nft.outputIndex}`}>
                                <Typography variant="body2">
                                  {truncate(nft.txHash, 12)}#{nft.outputIndex}
                                </Typography>
                              </Tooltip>
                            </TableCell>

                            {/* Actions Cell */}
                            <TableCell align="center">
                              <Button
                                variant="contained"
                                color="error"
                                size="small"
                                disabled={delistingInProgress.has(nft.utxoId)}
                                onClick={() => delistNFT(nft)}
                              >
                                {delistingInProgress.has(nft.utxoId) ? 'Delisting...' : 'Delist'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Pagination */}
                  <TablePagination
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    component="div"
                    count={filteredNFTs.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                  />
                </Paper>
              )}
            </Box>
          )}
        </Container>
      </div>
    </>
  );
}
