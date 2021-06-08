import path from 'path'
import * as core from '@actions/core'
import * as config from './config'
import {exec, execWithOptions} from './exec'
import {getAbsolutePath} from './file'

export async function isDockerBuildXInstalled(): Promise<boolean> {
	const r = await exec('docker', 'buildx', '--help')
	return r.exitCode === 0
}
export async function buildImage(
	imageName: string,
	checkoutPath: string
): Promise<boolean> {
	// TODO allow build args
	const args = ['buildx', 'build']
	args.push('--tag')
	args.push(`${imageName}:latest`)
	args.push('--cache-from')
	args.push(`type=registry,ref=${imageName}:latest`)
	args.push('--cache-to')
	args.push('type=inline')
	args.push('--output=type=docker')

	// TODO HACK - use build-args from devcontainer.json

	args.push(`${checkoutPath}/.devcontainer`) // TODO Add input for devcontainer path

	core.startGroup('Building dev container...')
	try {
		const buildResponse = await execWithOptions(
			'docker',
			{silent: false},
			...args
		)

		if (buildResponse.exitCode !== 0) {
			core.setFailed(
				`build failed with ${buildResponse.exitCode}: ${buildResponse.stderr}`
			)
			return false
		}
		core.info(buildResponse.stdout)
		return true
	} finally {
		core.endGroup()
	}
}

export async function runContainer(
	imageName: string,
	checkoutPath: string,
	command: string
): Promise<boolean> {
	const checkoutPathAbsolute = getAbsolutePath(checkoutPath, process.cwd())

	// TODO - add input for devcontainer path
	const devcontainerJsonPath = path.join(
		checkoutPathAbsolute,
		'.devcontainer/devcontainer.json'
	)
	const devcontainerConfig = await config.loadFromFile(devcontainerJsonPath)

	const workspaceFolder = config.getWorkspaceFolder(
		devcontainerConfig,
		checkoutPathAbsolute
	)
	const remoteUser = config.getRemoteUser(devcontainerConfig)

	// TODO - get run args from devcontainer.json? Or allow manually specifying them?
	const args = ['run']
	args.push(
		'--mount',
		`type=bind,src=${checkoutPathAbsolute},dst=${workspaceFolder}`
	)
	args.push('--workdir', workspaceFolder)
	args.push('--user', remoteUser)
	args.push(`${imageName}:latest`)
	args.push('bash', '-c', `sudo chown -R $(whoami) . && ${command}`) // TODO sort out permissions/user alignment

	core.startGroup('Running dev container...')
	try {
		const buildResponse = await execWithOptions(
			'docker',
			{silent: false},
			...args
		)

		if (buildResponse.exitCode !== 0) {
			core.setFailed(
				`run failed with ${buildResponse.exitCode}: ${buildResponse.stderr}`
			)
			return false
		}
		core.info(buildResponse.stdout)
		return true
	} finally {
		core.endGroup()
	}
}

export async function pushImage(imageName: string): Promise<boolean> {
	const args = ['push']
	args.push(`${imageName}:latest`)

	core.startGroup('Pushing image...')
	try {
		const buildResponse = await execWithOptions(
			'docker',
			{silent: false},
			...args
		)

		if (buildResponse.exitCode !== 0) {
			core.setFailed(
				`push failed with ${buildResponse.exitCode}: ${buildResponse.stderr}`
			)
			return false
		}
		core.info(buildResponse.stdout)
		return true
	} finally {
		core.endGroup()
	}
}
