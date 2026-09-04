import { UserPostList } from "@/components/post/UserPostList";

export default async function UserProfilePage(props: PageProps<"/users/[id]">) {
  const { id } = await props.params;
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <UserPostList userId={id} page={page} />
    </main>
  );
}
