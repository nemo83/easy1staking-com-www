import React from 'react';
import Head from 'next/head';

const VitevisVerification = () => {
  return (
    <>
      <Head>
        <title>Vitevis Wine Verification - Blockchain Authenticity</title>
        <meta name="description" content="Verify authentic Italian wines from Vitevis using blockchain technology" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Custom Vitevis styling - isolated from main site */}
      <style jsx global>{`
        .vitevis-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          min-height: 100vh;
          margin: 0;
          padding: 0;
        }

        .vitevis-header {
          background: linear-gradient(135deg, #6f1e1e 0%, #8b2635 50%, #a73d47 100%);
          color: white;
          padding: 3rem 1rem;
          text-align: center;
        }

        .vitevis-logo {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          letter-spacing: -0.025em;
        }

        .vitevis-subtitle {
          font-size: 1.1rem;
          opacity: 0.9;
          font-weight: 300;
        }

        .vitevis-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .vitevis-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .vitevis-section h2 {
          color: #6f1e1e;
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 1rem;
          border-bottom: 2px solid #f8f9fa;
          padding-bottom: 0.5rem;
        }

        .vitevis-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1rem;
        }

        .vitevis-table th,
        .vitevis-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #e9ecef;
          color: #374151;
        }

        .vitevis-table th {
          background-color: #6f1e1e;
          color: white;
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .vitevis-table tr:hover {
          background-color: #f8f9fa;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .status-verified {
          background-color: #d1f7c4;
          color: #166534;
        }

        .status-pending {
          background-color: #fef3c7;
          color: #92400e;
        }

        @media (max-width: 768px) {
          .vitevis-header {
            padding: 2rem 1rem;
          }

          .vitevis-logo {
            font-size: 2rem;
          }

          .vitevis-container {
            padding: 1rem;
          }

          .vitevis-section {
            padding: 1.5rem;
          }

          .vitevis-table {
            font-size: 0.875rem;
          }

          .vitevis-table th,
          .vitevis-table td {
            padding: 0.5rem 0.25rem;
          }
        }
      `}</style>

      <div className="vitevis-page">
        <header className="vitevis-header">
          <h1 className="vitevis-logo">Vitevis</h1>
          <p className="vitevis-subtitle">Authentic Italian Wines · Blockchain Verified</p>
        </header>

        <div className="vitevis-container">
          {/* Wine Tracking Explanation Section */}
          <section className="vitevis-section">
            <h2>Blockchain Wine Authentication</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Every bottle of Vitevis wine is tracked on the Cardano blockchain, ensuring complete transparency
                and authenticity from vineyard to your table. Our on-chain verification system provides immutable
                proof of origin, quality certifications, and supply chain integrity.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Certified Origin</h3>
                  <p className="text-sm text-gray-600">Verified vineyard source and production location in Veneto region</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Quality Assurance</h3>
                  <p className="text-sm text-gray-600">Independent quality certifications recorded immutably</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Supply Chain Transparency</h3>
                  <p className="text-sm text-gray-600">Complete traceability from grape to bottle</p>
                </div>
              </div>
            </div>
          </section>

          {/* Transactions Table Section */}
          <section className="vitevis-section">
            <h2>Verification Transactions</h2>
            <div className="overflow-x-auto">
              <table className="vitevis-table">
                <thead>
                  <tr>
                    <th>Transaction Hash</th>
                    <th>Timestamp</th>
                    <th>Bottle ID</th>
                    <th>Certificate Type</th>
                    <th>Issuer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono text-sm">dbaaeoe0b553f796...</td>
                    <td>25/12/2024</td>
                    <td className="font-semibold">Romeo & Juliet Merlot DOC 2023</td>
                    <td>SCM</td>
                    <td>Cantina Colli Vicentini</td>
                    <td><span className="status-badge status-verified">Verified</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-sm">969c9141d978b305...</td>
                    <td>14/06/2024</td>
                    <td className="font-semibold">Romeo & Juliet Merlot DOC 2023</td>
                    <td>Conformity Certificate</td>
                    <td>Veneto Wine Authority</td>
                    <td><span className="status-badge status-verified">Verified</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-sm">23b8e55b251d2d11...</td>
                    <td>06/12/2024</td>
                    <td className="font-semibold">Torre dei Vescovi Prosecco DOC</td>
                    <td>SCM</td>
                    <td>Vitevis Cooperative</td>
                    <td><span className="status-badge status-verified">Verified</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-sm">15a1879907fd5eb9...</td>
                    <td>21/11/2024</td>
                    <td className="font-semibold">Tullio I° Spumante Brut</td>
                    <td>SCM</td>
                    <td>Cantina Colli Vicentini</td>
                    <td><span className="status-badge status-verified">Verified</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-sm">1b0c149a78e544ad...</td>
                    <td>22/06/2024</td>
                    <td className="font-semibold">Cuvée del Fontatore</td>
                    <td>SCM</td>
                    <td>Vitevis Cooperative</td>
                    <td><span className="status-badge status-verified">Verified</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-sm">8c7d6e5f4g3h2i1j...</td>
                    <td>15/09/2024</td>
                    <td className="font-semibold">Romeo & Juliet Passimento Rosso</td>
                    <td>Conformity Certificate</td>
                    <td>Veneto Wine Authority</td>
                    <td><span className="status-badge status-pending">Pending</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-sm">a9b8c7d6e5f4g3h2...</td>
                    <td>03/11/2024</td>
                    <td className="font-semibold">Carlo V Special Reserve</td>
                    <td>SCM</td>
                    <td>Cantina Colli Vicentini</td>
                    <td><span className="status-badge status-verified">Verified</span></td>
                  </tr>
                  <tr>
                    <td className="font-mono text-sm">f1e2d3c4b5a6789...</td>
                    <td>28/08/2024</td>
                    <td className="font-semibold">Torre dei Vescovi Merlot DOC</td>
                    <td>Conformity Certificate</td>
                    <td>Veneto Wine Authority</td>
                    <td><span className="status-badge status-verified">Verified</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>Each transaction represents a blockchain verification step for our wines. All certificates are stored permanently and cannot be altered.</p>
            </div>
          </section>

          {/* Additional Info Section */}
          <section className="vitevis-section">
            <h2>About Our Verification Process</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">What We Track</h3>
                <ul className="text-gray-700 space-y-1 text-sm">
                  <li>• Vineyard location and harvesting date</li>
                  <li>• Grape variety and quality grade</li>
                  <li>• Fermentation and aging process</li>
                  <li>• Bottling location and date</li>
                  <li>• Quality control certifications</li>
                  <li>• Distribution chain custody</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Benefits for You</h3>
                <ul className="text-gray-700 space-y-1 text-sm">
                  <li>• Guaranteed authentic Italian wine</li>
                  <li>• Complete transparency of origin</li>
                  <li>• Verified quality certifications</li>
                  <li>• Protection against counterfeits</li>
                  <li>• Support for sustainable practices</li>
                  <li>• Connection to traditional terroir</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default VitevisVerification;