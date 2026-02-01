// 플랫폼 감지 및 추천 다운로드 링크 표시

(function() {
  'use strict';

  // 플랫폼 감지
  function detectPlatform() {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();

    if (platform.includes('mac') || userAgent.includes('mac')) {
      return 'macos';
    } else if (platform.includes('win') || userAgent.includes('windows')) {
      return 'windows';
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
      return 'linux';
    }

    return 'unknown';
  }

  // 추천 플랫폼 버튼 강조
  function highlightRecommended() {
    const platform = detectPlatform();

    // 모든 앱의 해당 플랫폼 버튼에 추천 표시
    document.querySelectorAll(`.download-btn.${platform}`).forEach(btn => {
      btn.classList.add('recommended');

      // 추천 배지 추가
      const badge = document.createElement('span');
      badge.className = 'recommended-badge';
      badge.textContent = '추천';
      badge.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        background: linear-gradient(135deg, #a855f7, #3b82f6);
        color: white;
        font-size: 0.7rem;
        padding: 2px 8px;
        border-radius: 10px;
        font-weight: 600;
      `;

      btn.style.position = 'relative';
      btn.appendChild(badge);
    });

    // 지원하지 않는 플랫폼 경고
    if (platform === 'linux' || platform === 'unknown') {
      const warning = document.createElement('div');
      warning.className = 'platform-warning';
      warning.innerHTML = `
        <p style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
                  padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem; color: #fca5a5;">
          ⚠️ 현재 플랫폼(${platform})은 지원되지 않습니다.
          macOS 또는 Windows에서 다운로드해 주세요.
        </p>
      `;
      const main = document.querySelector('main');
      if (main) {
        main.insertBefore(warning, main.firstChild);
      }
    }
  }

  // 다운로드 클릭 추적 (선택적 분석용)
  function trackDownloads() {
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const app = this.id.split('-')[0]; // gameplanner or stylestudio
        const platform = this.id.split('-')[1]; // macos or windows

        console.log(`[Download] ${app} for ${platform}`);

        // 여기에 분석 코드 추가 가능 (예: Google Analytics)
        // gtag('event', 'download', { app: app, platform: platform });
      });
    });
  }

  // 페이지 로드 시 실행
  document.addEventListener('DOMContentLoaded', function() {
    highlightRecommended();
    trackDownloads();
  });
})();
