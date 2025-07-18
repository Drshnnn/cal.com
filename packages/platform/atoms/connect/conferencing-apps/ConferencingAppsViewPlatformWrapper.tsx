"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useReducer, useState } from "react";

import AccountDialog from "@calcom/app-store/office365video/components/AccountDialog";
import { AppList } from "@calcom/features/apps/components/AppList";
import DisconnectIntegrationModal from "@calcom/features/apps/components/DisconnectIntegrationModal";
import SettingsHeader from "@calcom/features/settings/appDir/SettingsHeader";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { GOOGLE_MEET, OFFICE_365_VIDEO, ZOOM } from "@calcom/platform-constants";
import { QueryCell } from "@calcom/trpc/components/QueryCell";
import type { App } from "@calcom/types/App";
import { Button } from "@calcom/ui/components/button";
import {
  Dropdown,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownItem,
} from "@calcom/ui/components/dropdown";
import { EmptyScreen } from "@calcom/ui/components/empty-screen";
import { SkeletonContainer, SkeletonText } from "@calcom/ui/components/skeleton";

import { AtomsWrapper } from "../../src/components/atoms-wrapper";
import { useToast } from "../../src/components/ui/use-toast";
import type {
  BulkUpdatParams,
  UpdateUsersDefaultConferencingAppParams,
} from "./ConferencingAppsViewWebWrapper";
import { useAtomBulkUpdateEventTypesToDefaultLocation } from "./hooks/useAtomBulkUpdateEventTypesToDefaultLocation";
import { useAtomGetEventTypes } from "./hooks/useAtomGetEventTypes";
import {
  useAtomsGetInstalledConferencingApps,
  QUERY_KEY as atomsConferencingAppsQueryKey,
} from "./hooks/useAtomsGetInstalledConferencingApps";
import { useConnect } from "./hooks/useConnect";
import { useDeleteCredential } from "./hooks/useDeleteCredential";
import {
  useGetDefaultConferencingApp,
  QUERY_KEY as defaultConferencingAppQueryKey,
} from "./hooks/useGetDefaultConferencingApp";
import { useUpdateUserDefaultConferencingApp } from "./hooks/useUpdateUserDefaultConferencingApp";

type ConferencingAppSlug = typeof GOOGLE_MEET | typeof ZOOM | typeof OFFICE_365_VIDEO;

type ConferencingAppsViewPlatformWrapperProps = {
  disableToasts?: boolean;
  returnTo?: string;
  onErrorReturnTo?: string;
  teamId?: number;
  apps?: ConferencingAppSlug[];
  disableBulkUpdateEventTypes?: boolean;
};

type RemoveAppParams = { callback: () => void; app?: App["slug"] };

const SkeletonLoader = () => {
  return (
    <SkeletonContainer>
      <div className="divide-subtle border-subtle space-y-6 rounded-b-lg border border-t-0 px-6 py-4">
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
      </div>
    </SkeletonContainer>
  );
};

type ModalState = {
  isOpen: boolean;
  credentialId: null | number;
  app: App["slug"] | null;
};

export const ConferencingAppsViewPlatformWrapper = ({
  disableToasts = false,
  returnTo,
  onErrorReturnTo,
  teamId,
  apps,
  disableBulkUpdateEventTypes = false,
}: ConferencingAppsViewPlatformWrapperProps) => {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const showToast = (message: string, variant: "success" | "warning" | "error") => {
    if (!disableToasts) {
      toast({ description: message });
    }
  };

  const [modal, updateModal] = useReducer(
    (data: ModalState, partialData: Partial<ModalState>) => ({ ...data, ...partialData }),
    {
      isOpen: false,
      credentialId: null,
      app: null,
    }
  );

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const handleModelClose = () => {
    updateModal({ isOpen: false, credentialId: null, app: null });
  };

  const handleDisconnect = (credentialId: number, app: App["slug"]) => {
    updateModal({ isOpen: true, credentialId, app });
  };

  const installedIntegrationsQuery = useAtomsGetInstalledConferencingApps(teamId);
  const { data: defaultConferencingApp } = useGetDefaultConferencingApp(teamId);
  const { data: eventTypesQuery, isFetching: isEventTypesFetching } = useAtomGetEventTypes(
    teamId,
    disableBulkUpdateEventTypes
  );

  const deleteCredentialMutation = useDeleteCredential({
    onSuccess: () => {
      showToast(t("app_removed_successfully"), "success");
      handleModelClose();
      queryClient.invalidateQueries({
        queryKey: [atomsConferencingAppsQueryKey],
      });
      queryClient.resetQueries({
        queryKey: [defaultConferencingAppQueryKey],
      });
    },
    onError: () => {
      showToast(t("error_removing_app"), "error");
      handleModelClose();
    },
    teamId,
  });

  const updateDefaultAppMutation = useUpdateUserDefaultConferencingApp({
    teamId,
  });

  const bulkUpdateEventTypesToDefaultLocation = useAtomBulkUpdateEventTypesToDefaultLocation({
    teamId,
  });

  const handleRemoveApp = ({ app }: RemoveAppParams) => {
    !!app && deleteCredentialMutation.mutate(app);
  };

  const handleUpdateUserDefaultConferencingApp = ({
    appSlug,
    onSuccessCallback,
    onErrorCallback,
  }: UpdateUsersDefaultConferencingAppParams) => {
    updateDefaultAppMutation.mutate(appSlug, {
      onSuccess: () => {
        showToast("Default app updated successfully", "success");
        queryClient.invalidateQueries({ queryKey: [defaultConferencingAppQueryKey] });
        !disableBulkUpdateEventTypes && onSuccessCallback();
      },
      onError: (error) => {
        showToast(`Error: ${error.message}`, "error");
        onErrorCallback();
      },
    });
  };

  const handleBulkUpdateDefaultLocation = ({ eventTypeIds, callback }: BulkUpdatParams) => {
    if (disableBulkUpdateEventTypes) {
      callback();
      return;
    }

    bulkUpdateEventTypesToDefaultLocation.mutate(eventTypeIds, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [defaultConferencingAppQueryKey] });
        callback();
      },
    });
  };

  const handleConnectDisconnectIntegrationMenuToggle = () => {
    queryClient.invalidateQueries({ queryKey: [atomsConferencingAppsQueryKey] });
  };

  const handleBulkEditDialogToggle = () => {
    queryClient.invalidateQueries({ queryKey: [defaultConferencingAppQueryKey] });
  };

  const { connect } = useConnect({
    onSuccess: () => {
      showToast("app installed successfully", "success");
      queryClient.invalidateQueries({ queryKey: [atomsConferencingAppsQueryKey] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: [atomsConferencingAppsQueryKey] });
      showToast(`Error: unable to install app`, "error");
    },
    returnTo,
    onErrorReturnTo,
    teamId,
  });

  const AddConferencingButtonPlatform = ({ installedApps }: { installedApps?: Array<{ slug: string }> }) => {
    return (
      <Dropdown>
        <DropdownMenuTrigger asChild>
          <Button color="secondary" StartIcon="plus">
            {t("add")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* Show Google Meet if it's not installed and either no apps filter is provided or it's in the apps filter */}
          {installedApps &&
            !installedApps.find((app) => app.slug === GOOGLE_MEET) &&
            (!apps || apps.includes(GOOGLE_MEET)) && (
              <DropdownMenuItem>
                <DropdownItem color="secondary" onClick={() => connect(GOOGLE_MEET)}>
                  {t("google_meet")}
                </DropdownItem>
              </DropdownMenuItem>
            )}

          {/* Show Zoom if it's not installed and either no apps filter is provided or it's in the apps filter */}
          {installedApps &&
            !installedApps.find((app) => app.slug === ZOOM) &&
            (!apps || apps.includes(ZOOM)) && (
              <DropdownMenuItem>
                <DropdownItem color="secondary" onClick={() => connect(ZOOM)}>
                  {t("zoom")}
                </DropdownItem>
              </DropdownMenuItem>
            )}

          {/* Show Office 365 Video if it's not installed and either no apps filter is provided or it's in the apps filter */}
          {installedApps &&
            !installedApps.find((app) => app.slug === OFFICE_365_VIDEO) &&
            (!apps || apps.includes(OFFICE_365_VIDEO)) && (
              <DropdownMenuItem>
                <DropdownItem color="secondary" onClick={() => setIsAccountModalOpen(true)}>
                  {t("office_365_video")}
                </DropdownItem>
              </DropdownMenuItem>
            )}
        </DropdownMenuContent>
      </Dropdown>
    );
  };

  return (
    <AtomsWrapper>
      <SettingsHeader
        title={t("conferencing")}
        description={t("conferencing_description")}
        CTA={<AddConferencingButtonPlatform installedApps={installedIntegrationsQuery.data?.items} />}
        borderInShellHeader={true}>
        <>
          <div className="bg-default w-full sm:mx-0 xl:mt-0">
            <QueryCell
              query={installedIntegrationsQuery}
              customLoader={<SkeletonLoader />}
              success={({ data }) => {
                if (!data.items.length) {
                  return (
                    <EmptyScreen
                      Icon="calendar"
                      headline={t("no_category_apps", {
                        category: t("conferencing").toLowerCase(),
                      })}
                      description={t("no_category_apps_description_conferencing")}
                      buttonRaw={<AddConferencingButtonPlatform installedApps={data?.items} />}
                    />
                  );
                }
                return (
                  <AppList
                    listClassName="rounded-lg rounded-t-none border-t-0 max-w-full"
                    handleDisconnect={handleDisconnect}
                    data={data}
                    variant="conferencing"
                    defaultConferencingApp={defaultConferencingApp}
                    handleUpdateUserDefaultConferencingApp={handleUpdateUserDefaultConferencingApp}
                    handleBulkUpdateDefaultLocation={handleBulkUpdateDefaultLocation}
                    isBulkUpdateDefaultLocationPending={bulkUpdateEventTypesToDefaultLocation?.isPending}
                    eventTypes={eventTypesQuery?.eventTypes}
                    isEventTypesFetching={isEventTypesFetching}
                    handleConnectDisconnectIntegrationMenuToggle={
                      handleConnectDisconnectIntegrationMenuToggle
                    }
                    handleBulkEditDialogToggle={handleBulkEditDialogToggle}
                  />
                );
              }}
            />
          </div>
          <DisconnectIntegrationModal
            handleModelClose={handleModelClose}
            isOpen={modal.isOpen}
            credentialId={modal.credentialId}
            app={modal.app}
            handleRemoveApp={handleRemoveApp}
          />

          <AccountDialog
            open={isAccountModalOpen}
            onOpenChange={setIsAccountModalOpen}
            handleSubmit={() => connect(OFFICE_365_VIDEO)}
          />
        </>
      </SettingsHeader>
    </AtomsWrapper>
  );
};
