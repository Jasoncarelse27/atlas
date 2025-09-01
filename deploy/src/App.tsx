import React from 'react'
import RailwayPingTest from '../src/components/RailwayPingTest'
import ChatScreen from '../src/features/chat/components/ChatScreen'
import './App.css'

function App() {
  const [showPingTest, setShowPingTest] = React.useState(false)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Atlas AI</h1>
        <button 
          onClick={() => setShowPingTest(!showPingTest)}
          className="ping-test-button"
        >
          {showPingTest ? 'Hide' : 'Show'} Backend Test
        </button>
      </header>
      
      <main className="app-main">
        {showPingTest ? (
          <RailwayPingTest />
        ) : (
          <ChatScreen 
            userId="demo-user"
            subscription={null}
            onUpgrade={() => alert('Upgrade functionality coming soon!')}
          />
        )}
      </main>
    </div>
  )
}

export default App
