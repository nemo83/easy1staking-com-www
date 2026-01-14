import Head from 'next/head';
import Navbar from '@/components/Navbar';

export default function UplcLinkPage() {
  return (
    <>
      <Head>
        <title>UPLC.link - Cardano Smart Contract Verification | Easy1Staking</title>
        <meta name="description" content="Verify Cardano smart contracts match their published source code with UPLC.link" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <Navbar />

        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              UPLC.link
            </h1>
            <p className="text-xl text-gray-300">
              Cardano Smart Contract Verification
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 mb-8">
            <p className="text-gray-200 text-lg leading-relaxed mb-6">
              UPLC.link is an open-source platform for verifying that on-chain Cardano smart contracts
              match their published source code. Built for Aiken smart contracts, it provides a public
              registry of verified contracts with permanent on-chain proof of verification.
            </p>

            <ul className="text-gray-300 space-y-2 mb-8">
              <li>- Verify contracts against GitHub repositories</li>
              <li>- Support for parameterized validators</li>
              <li>- Public searchable registry of verified contracts</li>
              <li>- API access for programmatic verification queries</li>
            </ul>

            <div className="text-center">
              <a
                href="https://uplc.link"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors"
              >
                Visit UPLC.link
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
