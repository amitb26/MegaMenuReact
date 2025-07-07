import React from 'react';
import MegaMenuComponent from './components/MegaMenuComponent';
import { HttpClient } from '@microsoft/sp-http';

// Mock HttpClient for demo purposes
// In a real SharePoint environment, this would be provided by the SPFx context
const mockHttpClient = new HttpClient();

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MegaMenuComponent 
        siteUrl="https://your-sharepoint-site.sharepoint.com"
        httpClient={mockHttpClient}
      />
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Law School Portal
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed">
            Welcome to the law school portal. Use the navigation menu above to access different sections. 
            The mega menu provides quick access to program information, forms, library resources, applications, 
            and IT support.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
              <h3 className="font-semibold text-red-800 mb-2">Academic Programs</h3>
              <p className="text-red-700 text-sm">
                Explore our J.D., LL.M., M.S.L., and S.J.D. programs with detailed information about applications and requirements.
              </p>
            </div>
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">Student Resources</h3>
              <p className="text-blue-700 text-sm">
                Access forms, applications, and essential student services through our centralized portal.
              </p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">Library & IT</h3>
              <p className="text-green-700 text-sm">
                Find library resources and get IT support for all your academic technology needs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;