import * as os from 'os';
import {join} from 'path';
import execa from 'execa';
import {cleanup, writeFiles} from '../../../../../../../jest/helpers';
import androidSDK from '../androidSDK';
import getEnvironmentInfo from '../../../../tools/envinfo';
import {EnvironmentInfo} from '../../types';
import {NoopLoader} from '../../../../tools/loader';
import * as common from '../common';

const logSpy = jest.spyOn(common, 'logManualInstallation');

jest.mock('execa', () => jest.fn());

let mockWorkingDir = '';

// TODO remove when androidSDK starts getting gradle.build path from config
jest.mock('../../../../tools/config/findProjectRoot', () => () => {
  return mockWorkingDir;
});

describe('androidSDK', () => {
  beforeEach(() => {
    const random = Math.floor(Math.random() * 10000);
    mockWorkingDir = join(os.tmpdir(), `androidSdkTest-${random}`);

    writeFiles(mockWorkingDir, {
      'android/build.gradle': `
        buildscript {
          ext {
            buildToolsVersion = "28.0.3"
            minSdkVersion = 16
            compileSdkVersion = 28
            targetSdkVersion = 28
          }
        }
      `,
    });
  });

  afterAll(
    async () => await cleanup(join(mockWorkingDir, 'android/build.gradle')),
  );

  let environmentInfo: EnvironmentInfo;

  beforeAll(async () => {
    environmentInfo = await getEnvironmentInfo();
  }, 15000);

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns a message if the Android SDK is not installed', async () => {
    environmentInfo.SDKs['Android SDK'] = 'Not Found';
    ((execa as unknown) as jest.Mock).mockResolvedValue({stdout: ''});
    const diagnostics = await androidSDK.getDiagnostics(environmentInfo);
    expect(diagnostics.needsToBeFixed).toBe(true);
  });

  it('returns a message if the SDK version is not in range', async () => {
    // To avoid having to provide fake versions for all the Android SDK tools
    // @ts-ignore
    environmentInfo.SDKs['Android SDK'] = {
      'Build Tools': ['25.0.3'],
    };
    ((execa as unknown) as jest.Mock).mockResolvedValue({
      stdout: 'build-tools;25.0.3',
    });
    const diagnostics = await androidSDK.getDiagnostics(environmentInfo);
    expect(diagnostics.needsToBeFixed).toBe(true);
  });

  it('returns false if the SDK version is in range', async () => {
    // To avoid having to provide fake versions for all the Android SDK tools
    // @ts-ignore
    environmentInfo.SDKs['Android SDK'] = {
      'Build Tools': ['28.0.3'],
    };
    ((execa as unknown) as jest.Mock).mockResolvedValue({
      stdout: 'build-tools;28.0.3',
    });
    const diagnostics = await androidSDK.getDiagnostics(environmentInfo);
    expect(diagnostics.needsToBeFixed).toBe(false);
  });

  it('logs manual installation steps to the screen', () => {
    const loader = new NoopLoader();
    androidSDK.runAutomaticFix({loader, environmentInfo});
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('returns true if a build.gradle is not found', async () => {
    // To avoid having to provide fake versions for all the Android SDK tools
    // @ts-ignore
    environmentInfo.SDKs['Android SDK'] = {
      'Build Tools': ['28.0.3'],
    };
    ((execa as unknown) as jest.Mock).mockResolvedValue({
      stdout: 'build-tools;28.0.3',
    });

    await cleanup(join(mockWorkingDir, 'android/build.gradle'));

    const diagnostics = await androidSDK.getDiagnostics(environmentInfo);
    expect(diagnostics.needsToBeFixed).toBe(true);
  });
});
