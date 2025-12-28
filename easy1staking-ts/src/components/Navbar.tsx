"use client";
import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import Container from "@mui/material/Container";
import MenuItem from "@mui/material/MenuItem";
import Image from "next/image";
import Link from "next/link";
import Logo from "../../public/Logo.png";
import { useWallet } from "@meshsdk/react";
import ConnectWalletModal from "./ConnectWalletModal";
import { CardanoWallet } from "@meshsdk/react";
import { Toaster } from "react-hot-toast";

const Navbar = () => {

  const { wallet, connected } = useWallet();

  const pages = [
    {
      name: "Home",
      href: "/",
      enabled: true,
    },
    {
      name: "Staking Assessment",
      href: "/staking-assessment",
      enabled: true,
    },
    {
      name: "WMTx Conversion",
      href: "/wmtx-conversion",
      enabled: true,
    },
    {
      name: "Kreate Delist",
      href: "/kreate-delist",
      enabled: true,
      isNew: true,
    },
    {
      name: "Summit 2025 Discount",
      href: "/cardano-summit-2025",
      enabled: false,
      isNew: true,
    },
    {
      name: "Raffles",
      href: "/raffles",
      enabled: false,
    },
    {
      name: "NFT Raffles",
      href: "/nft-raffles",
      enabled: false,
    },
  ].filter((page) => page.enabled);

  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const closeWallet = () => {
    setIsOpen(false);
  };

  const handleOpenNavMenu = (event: any) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  return (
    <AppBar
      position="static"
      sx={{
        background: "none",
        boxShadow: "none",
      }}
      className="md:px-20 py-5"
    >
      <Toaster />
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo */}
          <Box
            sx={{
              flexGrow: { xs: 1, md: 0 },
              display: "flex",
              alignItems: "center",
            }}
          >
            <Image src={Logo} alt="Logo" width={40} height={40} />
          </Box>

          {/* Desktop Menu Items */}
          <Box
            sx={{
              flexGrow: 1,
              display: { xs: "none", md: "flex" },
              justifyContent: "center",
              marginLeft: 0,
            }}
          >
            {pages.map((page) => (
              <Link
                key={page.href}
                onClick={handleCloseNavMenu}
                href={page.href}
                className={`font-semibold mx-3 ${page.isNew ? "relative" : ""}`}
              >
                {page.name}
                {page.isNew && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                    NEW
                  </span>
                )}
              </Link>
            ))}
          </Box>

          {/* Connect Wallet Button */}
          <Box
            sx={{
              flexGrow: 0,
              display: "flex",
              alignItems: "center",
              marginLeft: "auto",
            }}
          >
            <div className="wallet-connect-wrapper">
              <style jsx>{`
                .wallet-connect-wrapper :global(button) {
                  color: #ffffff !important;
                  background-color: transparent !important;
                  border: 2px solid #ffffff !important;
                  border-radius: 9999px !important;
                  padding: 8px 16px !important;
                  font-weight: 600 !important;
                  font-size: 16px !important;
                }
                .wallet-connect-wrapper :global(button:hover) {
                  background-color: rgba(255, 255, 255, 0.1) !important;
                }
              `}</style>
              <CardanoWallet 
                label="Connect Wallet"
                isDark={false}
              />
            </div>
            {/* <button
              className="font-semibold text-[12px] md:text-[16px] py-2 px-4 md:py-3 border-white border-2 rounded-full mx-2"
              onClick={() => setIsOpen(true)}
            >
              {!wallet
                ? "Connect Wallet"
                : "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16".slice(
                  0,
                  6
                ) +
                "..." +
                "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16".slice(
                  -3
                )}
            </button> */}

            {/* Mobile Menu Icon */}
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
              sx={{ display: { xs: "flex", md: "none" } }}
            >
              <MenuIcon />
            </IconButton>
          </Box>

          {/* Mobile Menu */}
          <Menu
            id="menu-appbar"
            anchorEl={anchorElNav}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "left",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "left",
            }}
            open={Boolean(anchorElNav)}
            onClose={handleCloseNavMenu}
            sx={{ display: { xs: "block", md: "none" } }}
          >
            {pages.map((page) => (
              <MenuItem key={page.href} onClick={handleCloseNavMenu}>
                <Link className={`font-semibold ${page.isNew ? "relative" : ""}`} href={page.href}>
                  {page.name}
                  {page.isNew && (
                    <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                      NEW
                    </span>
                  )}
                </Link>
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </Container>
      {/* <ConnectWalletModal isOpen={isOpen} onClose={closeWallet} /> */}
    </AppBar>
  );
}

export default Navbar;
