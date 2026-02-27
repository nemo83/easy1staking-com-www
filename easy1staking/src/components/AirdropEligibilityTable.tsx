"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { EASY1STAKING_API } from "@/lib/util/Constants";
import toast from "react-hot-toast";

interface AirdropToken {
  logo: any;
  name: string;
  amount: string;
  dollarValue: string;
  description: string;
}

interface ExtraReward {
  symbol: string;
  amount: number;
  dollar_value: number;
  logo?: string;
  description?: string;
}

interface AirdropEligibilityTableProps {
  stakeBalance: string;
  walletAddress: string;
}

const AirdropEligibilityTable: React.FC<AirdropEligibilityTableProps> = ({ stakeBalance, walletAddress }) => {
  const [extraRewards, setExtraRewards] = useState<ExtraReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Convert stake balance to ADA (assuming it's in lovelaces)
  const adaBalance = parseFloat(stakeBalance) / 1000000;

  useEffect(() => {
    const fetchExtraRewards = async () => {
      if (!walletAddress) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`https://api.easy1staking.com/extra_rewards?stake_address=${encodeURIComponent(walletAddress)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch extra rewards: ${response.status}`);
        }
        
        const data: ExtraReward[] = await response.json();
        setExtraRewards(data);
      } catch (err) {
        console.error('Error fetching extra rewards:', err);
        setError('Failed to load extra rewards data');
        toast.error('Failed to load airdrop eligibility data', { duration: 3000 });
      } finally {
        setLoading(false);
      }
    };

    fetchExtraRewards();
  }, [walletAddress]);

  // Convert API data to display format
  const airdropTokens: AirdropToken[] = extraRewards.map((reward) => ({
    logo: reward.logo || "/Coin.png", // Fallback to coin image
    name: `${reward.symbol}`,
    amount: (reward.amount).toLocaleString(undefined, {
      maximumFractionDigits: 2
    }),
    dollarValue: reward.dollar_value.toFixed(2),
    description: reward.description || `Extra ${reward.symbol} rewards for EASY1 delegators`
  }));

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#304FFE] px-6 py-4">
          <h3 className="text-white text-xl font-semibold flex items-center">
            <span className="mr-2">🎁</span>
            Airdrop Eligibility - Delegate to EASY1 to Unlock
          </h3>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#304FFE] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading airdrop eligibility data...</p>
        </div>
      </div>
    );
  }

  if (error || extraRewards.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#304FFE] px-6 py-4">
          <h3 className="text-white text-xl font-semibold flex items-center">
            <span className="mr-2">🎁</span>
            Airdrop Eligibility - Delegate to EASY1 to Unlock
          </h3>
        </div>
        <div className="p-8 text-center">
          <p className="text-gray-600">
            {error || 'No extra rewards data available at this time.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-[#304FFE] px-6 py-4">
        <h3 className="text-white text-xl font-semibold flex items-center">
          <span className="mr-2">🎁</span>
          Airdrop Eligibility - Delegate to EASY1 to Unlock
        </h3>
        <p className="text-white/90 text-sm mt-1">
          Additional tokens you could claim on{' '}
          <a 
            href="https://tosidrop.me/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white underline hover:text-white/80 transition-colors"
          >
            TosiDrop
          </a>
          {' '}by delegating to EASY1 stake pool
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Token
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estimated Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Est. Value (USD)
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {airdropTokens.map((token, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 relative">
                      <Image
                        src={token.logo}
                        alt={token.name}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {token.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    {token.amount}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-green-600">
                    ${token.dollarValue}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-600 max-w-xs">
                    {token.description}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-gray-50 px-6 py-4 border-t">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="text-sm text-gray-600 mb-2 sm:mb-0">
            <strong>Your Stake:</strong> {adaBalance.toLocaleString()} ADA
          </div>
          <div className="text-sm font-medium text-[#304FFE]">
            Total Est. Value: ${extraRewards.reduce((sum, reward) => sum + reward.dollar_value, 0).toFixed(2)} per epoch
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          * Amounts are estimates based on your stake and historical distributions. Actual amounts may vary.
        </p>
      </div>
    </div>
  );
};

export default AirdropEligibilityTable;