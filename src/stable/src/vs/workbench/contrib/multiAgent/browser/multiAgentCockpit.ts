/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { EditorGroupLayout, GroupOrientation, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IPath } from '../../../../platform/window/common/window.js';

export interface IPathToOpen extends IPath {
	readonly viewColumn?: number;
}

export interface ICockpitEditorsState {
	readonly filesToOpenOrCreate?: IPathToOpen[];
	readonly filesToDiff?: IPathToOpen[];
	readonly filesToMerge?: IPathToOpen[];
	readonly layout?: EditorGroupLayout;
}

/**
 * MultiAgentCockpit encapsulates the native 3-column Cockpit layout logic
 * for the Agent-First IDE environment.
 * Spec: docs/architecture/06_mahub_ide_ui_blueprint.md
 * Spec: docs/AGENT_FIRST_TRANSFORMATION_PLAN.md
 */
export class MultiAgentCockpit {
	public static readonly SETTING_ENABLED = 'workbench.agentCockpit.enabled';

	public static isEnabled(configurationService: IConfigurationService): boolean {
		return configurationService.getValue<boolean>(MultiAgentCockpit.SETTING_ENABLED) ?? true;
	}

	/**
	 * Returns the 3-column horizontal cockpit editor layout.
	 * Column 1: Living PLAN.md (~28%)
	 * Column 2: Continuous Multi-Diff Staging (~44%)
	 * Column 3: Swarm Activity Stream (~28%)
	 */
	public static getCockpitLayout(): EditorGroupLayout {
		return {
			orientation: GroupOrientation.HORIZONTAL,
			groups: [
				{ size: 0.28 },
				{ size: 0.44 },
				{ size: 0.28 }
			]
		};
	}

	/**
	 * Resolves the initial editor state to automatically open the 3 cockpit documents
	 * when a new workspace is launched or when no previous editors exist.
	 */
	public static getInitialEditorsState(
		configurationService: IConfigurationService,
		contextService: IWorkspaceContextService,
		storageService: IStorageService,
		editorGroupService: IEditorGroupsService
	): ICockpitEditorsState | undefined {
		if (!this.isEnabled(configurationService)) {
			return undefined;
		}

		// Only activate Cockpit layout when opening a new workspace or when there is no restorable editor state
		const isNewWorkspace = storageService.isNew(StorageScope.WORKSPACE);
		const hasRestorableState = editorGroupService.hasRestorableState;
		if (!isNewWorkspace && hasRestorableState) {
			return undefined;
		}

		// Return the 3-column cockpit layout without hardcoding workspace files.
		// Centralized brain files (~/.multi-agent-ide/brain/<slug>/) are populated
		// by the multi-agent-harness extension once initialized.
		return {
			layout: this.getCockpitLayout()
		};
	}
}

