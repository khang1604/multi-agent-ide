/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ValueWithChangeEvent } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IMultiDiffSourceResolver, IMultiDiffSourceResolverService, IResolvedMultiDiffSource, MultiDiffEditorItem } from '../../multiDiffEditor/browser/multiDiffSourceResolverService.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Action2 } from '../../../../platform/actions/common/actions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService, GroupsOrder } from '../../../services/editor/common/editorGroupsService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { localize2 } from '../../../../nls.js';
import { MultiAgentCockpit } from './multiAgentCockpit.js';

/**
 * AgentMultiDiffSourceResolver connects the Multi-Agent orchestrator
 * directly into VS Code's native Multi-Diff Editor (Tier 2).
 * Spec: docs/architecture/06_mahub_ide_ui_blueprint.md
 * Spec: docs/AGENT_FIRST_TRANSFORMATION_PLAN.md
 */
export class AgentMultiDiffSourceResolver implements IMultiDiffSourceResolver {
	public static readonly SCHEME = 'agent-multi-diff';

	private static _instance: AgentMultiDiffSourceResolver | undefined;
	public static getInstance(): AgentMultiDiffSourceResolver | undefined {
		return AgentMultiDiffSourceResolver._instance;
	}

	private readonly _resources: ValueWithChangeEvent<readonly MultiDiffEditorItem[]>;
	private readonly _label: ValueWithChangeEvent<string>;

	constructor(
		@IWorkspaceContextService private readonly _contextService: IWorkspaceContextService,
	) {
		AgentMultiDiffSourceResolver._instance = this;

		const initialItems: MultiDiffEditorItem[] = [];
		const workspaceFolders = this._contextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			const rootUri = workspaceFolders[0].uri;
			const stagingDiffUri = joinPath(rootUri, '.local', 'DIFF_STAGING.diff');
			initialItems.push(
				new MultiDiffEditorItem(
					stagingDiffUri,
					stagingDiffUri,
					stagingDiffUri,
					'Continuous Staging Stream'
				)
			);
		}

		this._resources = new ValueWithChangeEvent<readonly MultiDiffEditorItem[]>(initialItems);
		this._label = new ValueWithChangeEvent<string>('Continuous Multi-Diff Staging');
	}

	public static getMultiDiffSourceUri(taskId?: string): URI {
		return URI.from({
			scheme: AgentMultiDiffSourceResolver.SCHEME,
			path: taskId ? `task-${taskId}` : 'continuous-staging',
		});
	}

	canHandleUri(uri: URI): boolean {
		return uri.scheme === AgentMultiDiffSourceResolver.SCHEME;
	}

	async resolveDiffSource(_uri: URI): Promise<IResolvedMultiDiffSource> {
		return {
			resources: this._resources,
			label: this._label
		};
	}

	public updateDiffItems(items: MultiDiffEditorItem[], label?: string): void {
		this._resources.value = items;
		if (label) {
			this._label.value = label;
		}
	}

	public setWorktreeDiffs(originalUris: URI[], worktreeUris: URI[], label?: string): void {
		const items: MultiDiffEditorItem[] = [];
		for (let i = 0; i < Math.min(originalUris.length, worktreeUris.length); i++) {
			items.push(new MultiDiffEditorItem(
				originalUris[i],
				worktreeUris[i],
				originalUris[i]
			));
		}
		this.updateDiffItems(items, label);
	}
}

/**
 * Workbench contribution that registers AgentMultiDiffSourceResolver
 * and auto-docks native Multi-Diff in Column 2 on workspace restoration.
 */
export class AgentMultiDiffContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.agentMultiDiff';

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IMultiDiffSourceResolverService multiDiffSourceResolverService: IMultiDiffSourceResolverService,
		@IEditorGroupsService editorGroupsService: IEditorGroupsService,
		@IEditorService editorService: IEditorService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super();
		const resolver = instantiationService.createInstance(AgentMultiDiffSourceResolver);
		this._register(multiDiffSourceResolverService.registerResolver(resolver));

		// Auto-dock native Multi-Diff into Column 2 when Cockpit is enabled
		editorGroupsService.whenRestored.then(() => {
			if (MultiAgentCockpit.isEnabled(configurationService)) {
				const groups = editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE);
				if (groups.length >= 2) {
					const column2Group = groups[1];
					editorService.openEditor({
						label: 'Continuous Multi-Diff Staging',
						multiDiffSource: AgentMultiDiffSourceResolver.getMultiDiffSourceUri(),
						options: { pinned: true, preserveFocus: true }
					}, column2Group);
				}
			}
		});
	}
}

/**
 * Command action to open or focus the Continuous Multi-Diff Editor
 */
export class OpenAgentMultiDiffEditorAction extends Action2 {
	static readonly ID = 'workbench.action.multiAgent.openContinuousDiff';

	constructor() {
		super({
			id: OpenAgentMultiDiffEditorAction.ID,
			title: localize2('openContinuousDiff', 'Multi Agent: Open Continuous Multi-Diff'),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor, taskId?: string): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const editorGroupsService = accessor.get(IEditorGroupsService);
		const multiDiffSource = AgentMultiDiffSourceResolver.getMultiDiffSourceUri(taskId);

		const groups = editorGroupsService.getGroups(GroupsOrder.GRID_APPEARANCE);
		const targetGroup = groups.length >= 2 ? groups[1] : undefined;

		await editorService.openEditor({
			label: 'Continuous Multi-Diff Staging',
			multiDiffSource,
			options: { pinned: true, preserveFocus: false }
		}, targetGroup);
	}
}
