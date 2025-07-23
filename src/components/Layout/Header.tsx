import React from 'react';
import { Video, LogOut, User, Settings, Code } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function Header() {
  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Metstack
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Code className="w-4 h-4" />
              <span>by <a href="https://instagram.com/aftabxplained" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:text-blue-700">Aftabstack</a></span>
            </div>
            <Link
              to="/create-meeting"
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105"
            >
              Create Meeting
            </Link>
          </nav>
          
          {/* Mobile menu */}
          <div className="md:hidden flex items-center space-x-2">
            <Link
              to="/create-meeting"
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all text-sm"
            >
              Create
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}