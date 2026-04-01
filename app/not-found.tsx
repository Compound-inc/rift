"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function NotFound() {
  const [blink, setBlink] = useState(true);
  const [time, setTime] = useState("");
  const [windowActive, setWindowActive] = useState(true);

  useEffect(() => {
    const blinkInterval = setInterval(() => setBlink((b) => !b), 530);
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => {
      clearInterval(blinkInterval);
      clearInterval(clockInterval);
    };
  }, []);

  return (
    <div className="win2k-desktop">
      {/* Desktop background */}
      <div className="desktop-bg">
        {/* Desktop icons */}
        <div className="desktop-icons">
          <DesktopIcon label="My Computer" icon="🖥️" />
          <DesktopIcon label="My Documents" icon="📁" />
          <DesktopIcon label="Recycle Bin" icon="🗑️" />
          <DesktopIcon label="Internet Explorer" icon="🌐" />
        </div>

        {/* Error Dialog Window */}
        <div
          className="win2k-window error-window"
          onMouseEnter={() => setWindowActive(true)}
        >
          {/* Title bar */}
          <div className={`win2k-titlebar ${windowActive ? "active" : "inactive"}`}>
            <div className="titlebar-icon">⚠️</div>
            <span className="titlebar-text">Rift – Page Not Found</span>
            <div className="titlebar-buttons">
              <button className="win2k-btn titlebar-btn" aria-label="Minimize">_</button>
              <button className="win2k-btn titlebar-btn" aria-label="Maximize">□</button>
              <button className="win2k-btn titlebar-btn close-btn" aria-label="Close">✕</button>
            </div>
          </div>

          {/* Menu bar */}
          <div className="win2k-menubar">
            <span className="menu-item">File</span>
            <span className="menu-item">Edit</span>
            <span className="menu-item">View</span>
            <span className="menu-item">Help</span>
          </div>

          {/* Window content */}
          <div className="win2k-content">
            {/* Error icon area */}
            <div className="error-body">
              <div className="error-icon-area">
                <div className="error-stop-sign">
                  <span>!</span>
                </div>
              </div>
              <div className="error-text-area">
                <p className="error-title">Error 404: Page Not Found</p>
                <div className="error-divider" />
                <p className="error-desc">
                  Windows cannot find the requested page. The file may have been moved,
                  renamed, or deleted. Please verify that the path is correct and try again.
                </p>
                <div className="error-code-box">
                  <span className="error-code-label">Error details:</span>
                  <span className="error-code">
                    HTTP 404 · INET_E_RESOURCE_NOT_FOUND · 0x800C0005
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="win2k-actions">
              <Link href="/" className="win2k-action-btn primary">
                <span>🏠</span>
                <span>Go to Homepage</span>
              </Link>
              <button
                className="win2k-action-btn"
                onClick={() => window.history.back()}
              >
                <span>⬅️</span>
                <span>Go Back</span>
              </button>
              <button
                className="win2k-action-btn"
                onClick={() => window.location.reload()}
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div className="win2k-statusbar">
            <span>Ready</span>
            <span className="status-zone">Internet Zone</span>
          </div>
        </div>

        {/* Second smaller info window */}
        <div className="win2k-window info-window" onMouseEnter={() => setWindowActive(false)}>
          <div className="win2k-titlebar inactive">
            <div className="titlebar-icon">ℹ️</div>
            <span className="titlebar-text">System Information</span>
            <div className="titlebar-buttons">
              <button className="win2k-btn titlebar-btn" aria-label="Minimize">_</button>
              <button className="win2k-btn titlebar-btn" aria-label="Close">✕</button>
            </div>
          </div>
          <div className="win2k-content small-content">
            <div className="sysinfo-row">
              <span className="sysinfo-label">System:</span>
              <span className="sysinfo-value">Rift Enterprise 2000</span>
            </div>
            <div className="sysinfo-row">
              <span className="sysinfo-label">Version:</span>
              <span className="sysinfo-value">5.00.2195 SP4</span>
            </div>
            <div className="sysinfo-row">
              <span className="sysinfo-label">Processor:</span>
              <span className="sysinfo-value">AI x64 @ 999 GHz</span>
            </div>
            <div className="sysinfo-row">
              <span className="sysinfo-label">Memory:</span>
              <span className="sysinfo-value">∞ MB RAM</span>
            </div>
            <div className="sysinfo-row">
              <span className="sysinfo-label">Status:</span>
              <span className="sysinfo-value status-error">404 Not Found</span>
            </div>
          </div>
        </div>
      </div>

      {/* Taskbar */}
      <div className="win2k-taskbar">
        <button className="start-button">
          <span className="start-logo">⊞</span>
          <span className="start-text">Start</span>
        </button>
        <div className="taskbar-divider" />
        <div className="taskbar-tasks">
          <div className="taskbar-task active-task">
            ⚠️ Rift – Page Not Found
          </div>
          <div className="taskbar-task">
            ℹ️ System Information
          </div>
        </div>
        <div className="system-tray">
          <span className="tray-icon" title="Network">🌐</span>
          <span className="tray-icon" title="Sound">🔊</span>
          <div className="tray-clock">
            <span className={blink ? "blink-on" : "blink-off"}>:</span>
            {time}
          </div>
        </div>
      </div>

      <style jsx>{`
        .win2k-desktop {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          font-family: 'Tahoma', 'MS Sans Serif', Arial, sans-serif;
          font-size: 11px;
          overflow: hidden;
          background: #008080;
          cursor: default;
          user-select: none;
        }

        .desktop-bg {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: #008080;
          background-image:
            radial-gradient(circle at 20% 30%, rgba(0,100,100,0.3) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(0,60,80,0.3) 0%, transparent 40%);
        }

        /* Desktop icons */
        .desktop-icons {
          position: absolute;
          top: 12px;
          left: 12px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Win2k Window */
        .win2k-window {
          position: absolute;
          background: #d4d0c8;
          border: 2px solid;
          border-color: #ffffff #808080 #808080 #ffffff;
          box-shadow: 2px 2px 0 0 #000000;
          min-width: 280px;
        }

        .error-window {
          width: min(560px, calc(100vw - 140px));
          top: 50%;
          left: 50%;
          transform: translate(-30%, -52%);
        }

        .info-window {
          width: 220px;
          top: 50%;
          left: 50%;
          transform: translate(60%, -10%);
        }

        @media (max-width: 768px) {
          .error-window {
            width: calc(100vw - 24px);
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
          }
          .info-window {
            display: none;
          }
        }

        /* Title bar */
        .win2k-titlebar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 4px;
          height: 22px;
          user-select: none;
        }

        .win2k-titlebar.active {
          background: linear-gradient(to right, #0a246a, #a6caf0);
        }

        .win2k-titlebar.inactive {
          background: linear-gradient(to right, #7f7f7f, #c0c0c0);
        }

        .titlebar-icon {
          font-size: 13px;
          line-height: 1;
          flex-shrink: 0;
        }

        .titlebar-text {
          flex: 1;
          color: #ffffff;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
        }

        .titlebar-buttons {
          display: flex;
          gap: 2px;
          flex-shrink: 0;
        }

        .win2k-btn {
          background: #d4d0c8;
          border: 1.5px solid;
          border-color: #ffffff #808080 #808080 #ffffff;
          cursor: pointer;
          font-size: 9px;
          font-family: inherit;
          color: #000000;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .win2k-btn:active {
          border-color: #808080 #ffffff #ffffff #808080;
        }

        .titlebar-btn {
          width: 16px;
          height: 14px;
          font-size: 8px;
        }

        .close-btn {
          font-size: 9px;
        }

        /* Menu bar */
        .win2k-menubar {
          display: flex;
          gap: 0;
          padding: 1px 2px;
          background: #d4d0c8;
          border-bottom: 1px solid #808080;
          font-size: 11px;
        }

        .menu-item {
          padding: 2px 8px;
          cursor: pointer;
          color: #000000;
        }

        .menu-item:hover {
          background: #0a246a;
          color: #ffffff;
        }

        /* Window content */
        .win2k-content {
          padding: 12px;
          background: #d4d0c8;
        }

        .small-content {
          padding: 8px;
        }

        /* Error body layout */
        .error-body {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .error-icon-area {
          flex-shrink: 0;
        }

        .error-stop-sign {
          width: 48px;
          height: 48px;
          background: #cc0000;
          clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 26px;
          font-weight: bold;
          font-family: 'Times New Roman', serif;
        }

        .error-text-area {
          flex: 1;
        }

        .error-title {
          font-size: 13px;
          font-weight: bold;
          color: #000000;
          margin-bottom: 6px;
        }

        .error-divider {
          height: 1px;
          background: #808080;
          margin-bottom: 8px;
          box-shadow: 0 1px 0 #ffffff;
        }

        .error-desc {
          font-size: 11px;
          color: #000000;
          line-height: 1.5;
          margin-bottom: 8px;
        }

        .error-code-box {
          background: #ffffff;
          border: 1px solid;
          border-color: #808080 #ffffff #ffffff #808080;
          padding: 4px 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .error-code-label {
          font-size: 10px;
          color: #666666;
        }

        .error-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 10px;
          color: #000080;
        }

        /* Action buttons */
        .win2k-actions {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .win2k-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 12px;
          background: #d4d0c8;
          border: 1.5px solid;
          border-color: #ffffff #808080 #808080 #ffffff;
          box-shadow: 1px 1px 0 #000000;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          color: #000000;
          text-decoration: none;
          min-width: 80px;
          justify-content: center;
        }

        .win2k-action-btn:hover {
          background: #ece9d8;
        }

        .win2k-action-btn:active {
          border-color: #808080 #ffffff #ffffff #808080;
          box-shadow: none;
          transform: translate(1px, 1px);
        }

        .win2k-action-btn.primary {
          font-weight: bold;
        }

        /* Status bar */
        .win2k-statusbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2px 6px;
          border-top: 1px solid #808080;
          background: #d4d0c8;
          font-size: 10px;
          color: #000000;
        }

        .status-zone {
          padding: 1px 4px;
          border: 1px solid;
          border-color: #808080 #ffffff #ffffff #808080;
        }

        /* System info */
        .sysinfo-row {
          display: flex;
          gap: 6px;
          padding: 3px 0;
          border-bottom: 1px solid #c0c0c0;
          font-size: 10px;
        }

        .sysinfo-label {
          color: #666666;
          width: 70px;
          flex-shrink: 0;
        }

        .sysinfo-value {
          color: #000000;
          font-weight: bold;
        }

        .status-error {
          color: #cc0000;
        }

        /* Desktop icon */
        .desktop-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 64px;
          cursor: pointer;
          padding: 4px;
        }

        .desktop-icon:hover .icon-label {
          background: #0a246a;
          color: #ffffff;
        }

        .icon-emoji {
          font-size: 28px;
          line-height: 1;
        }

        .icon-label {
          font-size: 10px;
          color: #ffffff;
          text-align: center;
          text-shadow: 1px 1px 2px #000000;
          padding: 1px 2px;
          white-space: nowrap;
        }

        /* Taskbar */
        .win2k-taskbar {
          height: 30px;
          background: #d4d0c8;
          border-top: 2px solid #ffffff;
          display: flex;
          align-items: center;
          padding: 2px 4px;
          gap: 4px;
          flex-shrink: 0;
        }

        .start-button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: #d4d0c8;
          border: 1.5px solid;
          border-color: #ffffff #808080 #808080 #ffffff;
          font-family: inherit;
          font-size: 11px;
          font-weight: bold;
          color: #000000;
          cursor: pointer;
          height: 22px;
          box-shadow: 1px 1px 0 #000000;
        }

        .start-button:active {
          border-color: #808080 #ffffff #ffffff #808080;
          box-shadow: none;
        }

        .start-logo {
          font-size: 14px;
          color: #0000cc;
        }

        .start-text {
          font-size: 11px;
        }

        .taskbar-divider {
          width: 1px;
          height: 20px;
          background: #808080;
          box-shadow: 1px 0 0 #ffffff;
          flex-shrink: 0;
        }

        .taskbar-tasks {
          flex: 1;
          display: flex;
          gap: 2px;
          overflow: hidden;
        }

        .taskbar-task {
          padding: 2px 8px;
          background: #d4d0c8;
          border: 1px solid;
          border-color: #808080 #ffffff #ffffff #808080;
          font-size: 10px;
          max-width: 160px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          height: 22px;
          display: flex;
          align-items: center;
        }

        .taskbar-task.active-task {
          background: #b0b0a8;
          border-color: #808080 #ffffff #ffffff #808080;
          box-shadow: inset 1px 1px 2px rgba(0,0,0,0.2);
        }

        .system-tray {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border: 1px solid;
          border-color: #808080 #ffffff #ffffff #808080;
          height: 22px;
          font-size: 10px;
        }

        .tray-icon {
          font-size: 14px;
          cursor: pointer;
        }

        .tray-clock {
          font-size: 11px;
          font-weight: bold;
          color: #000000;
          min-width: 56px;
          text-align: center;
        }

        .blink-on { opacity: 1; }
        .blink-off { opacity: 0; }
      `}</style>
    </div>
  );
}

function DesktopIcon({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="desktop-icon" role="button" tabIndex={0} aria-label={label}>
      <span className="icon-emoji" aria-hidden="true">{icon}</span>
      <span className="icon-label">{label}</span>
    </div>
  );
}
