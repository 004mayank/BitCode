import { BountyDetails } from "../../../components/BountyDetails";

export default async function Page({ params }: { params: Promise<{ bountyId: string }> }) {
  const { bountyId } = await params;
  return <BountyDetails bountyId={bountyId} />;
}

