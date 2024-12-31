import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { removeToken, getToken } from '../utils/auth';
import './Dashboard.css';

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(false);
  const userEmail = localStorage.getItem('userEmail');
  const navigate = useNavigate();

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/users/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      removeToken();
      localStorage.removeItem('userEmail');
      window.location.href = '/';
      
    } catch (error) {
      console.error('Logout error:', error);
      removeToken();
      localStorage.removeItem('userEmail');
      window.location.href = '/';
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">Dashboard</div>
        <div className="nav-user">
          <span>{userEmail}</span>
          <button 
            onClick={handleLogout} 
            className="logout-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome to Your Dashboard</h1>
          <p>You've successfully logged in!</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card" onClick={() => navigate('/tutors')}>
            <h3>Find Tutors</h3>
            <p>Browse available instructors</p>
            <div className="card-icon">👨‍🏫</div>
          </div>
          {/* Add more dashboard cards here */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 