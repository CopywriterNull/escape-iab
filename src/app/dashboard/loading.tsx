import {
  ActivitySkeleton,
  BannerSkeleton,
  ChartSkeleton,
  FunnelSkeleton,
  HeroSkeleton,
  KPIGridSkeleton,
  PageHeaderSkeleton,
  SampleSizeSkeleton,
  SourcesSkeleton,
} from "./_components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <HeroSkeleton />
        <BannerSkeleton />
        <KPIGridSkeleton />
        <FunnelSkeleton />
        <div className="grid lg:grid-cols-12 gap-4">
          <div className="flex flex-col gap-4 lg:col-span-7">
            <SourcesSkeleton />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <ChartSkeleton />
            <SampleSizeSkeleton />
          </div>
        </div>
        <ActivitySkeleton />
      </div>
    </div>
  );
}
