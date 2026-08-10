export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-32 text-center">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-muted-foreground">이 페이지에 접근할 권한이 없습니다.</p>
    </div>
  );
}
