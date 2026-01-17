// 도움말 모달 컴포넌트

import { X, MousePointer, Calendar, Trash2, Move, Palette, Users, Eye } from 'lucide-react'

interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">사용 가이드</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)] space-y-6">
          {/* 일정 등록 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <Calendar className="w-5 h-5 text-primary" />
              일정 등록
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono shrink-0">Ctrl</kbd>
                <span>+ 마우스 드래그: 새 일정을 생성합니다. 시작일부터 종료일까지 드래그하세요.</span>
              </p>
              <p className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono shrink-0">Alt</kbd>
                <span>+ 마우스 드래그: 연차 일정을 빨간색으로 빠르게 등록합니다.</span>
              </p>
            </div>
          </section>

          {/* 일정 수정 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <MousePointer className="w-5 h-5 text-primary" />
              일정 수정
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>더블 클릭:</strong> 일정 카드를 더블 클릭하면 제목, 메모, 링크를 수정할 수 있습니다.</p>
              <p><strong>드래그:</strong> 일정 카드를 드래그하여 날짜를 변경할 수 있습니다.</p>
              <p><strong>리사이즈:</strong> 일정 카드의 좌우 가장자리를 드래그하여 기간을 조정할 수 있습니다.</p>
            </div>
          </section>

          {/* 일정 삭제 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <Trash2 className="w-5 h-5 text-destructive" />
              일정 삭제
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono shrink-0">Delete</kbd>
                <span>또는 <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Backspace</kbd>: 선택한 일정을 삭제합니다.</span>
              </p>
              <p>일정을 클릭하여 선택한 후 키를 누르세요.</p>
            </div>
          </section>

          {/* 색상 변경 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <Palette className="w-5 h-5 text-primary" />
              색상 변경
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>우클릭:</strong> 일정 카드를 우클릭하면 색상을 변경할 수 있는 메뉴가 나타납니다.</p>
              <p><strong>기본 색상 설정:</strong> 상단의 "색상 설정" 버튼을 클릭하여 새 일정의 기본 색상을 지정할 수 있습니다.</p>
            </div>
          </section>

          {/* 업무 이관 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <Move className="w-5 h-5 text-primary" />
              업무 이관
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>우클릭 → 업무 이관:</strong> 일정 카드를 우클릭하여 다른 팀원에게 업무를 이관할 수 있습니다.</p>
              <p>이관 시 빈 행이 없으면 자동으로 새 행이 추가됩니다.</p>
            </div>
          </section>

          {/* 월 필터링 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <Eye className="w-5 h-5 text-primary" />
              월 필터링
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>눈 아이콘:</strong> 월 드롭다운에서 눈 아이콘을 클릭하면 해당 월을 숨기거나 표시할 수 있습니다.</p>
              <p>숨긴 월에 걸친 일정은 표시되는 부분만 보여집니다.</p>
            </div>
          </section>

          {/* 팀원 관리 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <Users className="w-5 h-5 text-primary" />
              팀원 관리 (관리자)
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>상단의 "팀원 관리" 버튼을 클릭하여 팀원을 추가, 수정, 삭제할 수 있습니다.</p>
              <p>팀원의 순서를 변경하거나 특정 팀원을 숨길 수 있습니다.</p>
            </div>
          </section>

          {/* 특이사항 행 */}
          <section>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3">
              <Calendar className="w-5 h-5 text-amber-500" />
              특이사항 (글로벌 이벤트)
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>화면 최상단의 "특이사항" 행은 모든 팀원에게 공유되는 일정입니다.</p>
              <p>관리자만 통합 탭에서 편집할 수 있으며, 팀원 탭에서는 읽기 전용으로 표시됩니다.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
