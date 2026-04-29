import { ChallengeAttempt } from "../../../../components/ChallengeAttempt";

export default async function Page({ params }: { params: Promise<{ challengeId: string }> }) {
  const { challengeId } = await params;
  return <ChallengeAttempt challengeId={challengeId} />;
}
