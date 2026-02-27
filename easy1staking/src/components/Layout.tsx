import type { AppProps } from "next/app";
import React, { ReactNode } from "react";
import Navbar from "./Navbar";
import { Toaster } from "react-hot-toast";
import Footer from "./Footer";

type DashboardLayoutProps = {
    children: React.ReactNode,
};

const Layout = ({ children }: DashboardLayoutProps) => {
    return (
        <div className="home-bg">
            <Toaster />
            {children}
            <div className="mt-20">
                <Footer />
            </div>
        </div>
    )
}

export default Layout;
